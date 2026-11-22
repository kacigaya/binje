import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { timingSafeEqual } from "node:crypto";
import { readlinkSync, realpathSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { fetchPublic } from "../../lib/safe-fetch";

const WORKER_DIR = fileURLToPath(new URL("../scripts/vidcore-worker/", import.meta.url));
const MAX_REPLY = 2 * 1024 * 1024;
const MAX_LINE = 64 * 1024;
const EXTRACT_TIMEOUT = 10_000;
const WORKER_IDLE_TIMEOUT = 5 * 60_000;
const ALLOWED_HEADERS = ["user-agent", "referer", "origin", "accept", "content-type"];

type Message = Record<string, unknown>;
type Job = {
  abort: AbortController;
  candidate: (value: { url: string; noReferrer: boolean }) => void;
  finish: () => void;
  calls: number;
  candidates: number;
};

async function relay(message: Message, signal: AbortSignal): Promise<Message> {
  if (typeof message.url !== "string" || message.url.length > 8192) throw new Error("Invalid URL.");
  const url = new URL(message.url);
  if (url.origin !== "https://vidcore.io" || url.username || url.password) throw new Error("Invalid origin.");
  if (message.method !== "GET" && message.method !== "POST") throw new Error("Invalid method.");
  if (message.body !== undefined && (typeof message.body !== "string" || message.body.length > 8192)) {
    throw new Error("Invalid body.");
  }
  const headers = new Headers();
  if (message.headers && typeof message.headers === "object") {
    for (const [key, value] of Object.entries(message.headers)) {
      if (ALLOWED_HEADERS.includes(key) && typeof value === "string" && value.length <= 2048) headers.set(key, value);
    }
  }
  const response = await fetchPublic(url, {
    method: message.method,
    headers,
    body: message.body,
    redirect: "manual",
    signal,
  });
  const reader = response.body?.getReader();
  if (!reader) return { status: response.status };
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REPLY) throw new Error("Response too large.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return { status: response.status, body: Buffer.concat(chunks, size).toString("base64") };
}

class Slot {
  child?: ChildProcessWithoutNullStreams;
  job?: Job;
  stopTimer?: ReturnType<typeof setTimeout>;
  idleTimer?: ReturnType<typeof setTimeout>;

  start() {
    const node = realpathSync(process.execPath);
    const args = ["--unshare-all", "--die-with-parent", "--clearenv", "--ro-bind", "/usr", "/usr"];
    for (const directory of ["/lib", "/lib64"]) {
      try {
        args.push("--symlink", readlinkSync(directory), directory);
      } catch {
        args.push("--ro-bind-try", directory, directory);
      }
    }
    const child = spawn("/usr/bin/bwrap", [
      ...args, "--proc", "/proc", "--dev", "/dev",
      "--ro-bind", node, "/node", "--ro-bind", WORKER_DIR, "/worker", "--chdir", "/worker",
      "/node", "--max-old-space-size=256", "--permission", "--allow-fs-read=/worker", "worker.mjs",
    ], { env: { NODE_ENV: "production" } });
    this.child = child;
    child.stdin.on("error", () => this.reset(child));
    child.on("error", () => this.reset(child));
    child.on("exit", () => this.reset(child));
    child.stderr.resume();
    child.stdout.setEncoding("utf8");
    let buffered = "";
    child.stdout.on("data", (chunk: string) => {
      buffered += chunk;
      let end = buffered.indexOf("\n");
      while (end !== -1 && end <= MAX_LINE) {
        try {
          this.message(child, JSON.parse(buffered.slice(0, end)));
        } catch {
          this.reset(child);
          return;
        }
        buffered = buffered.slice(end + 1);
        end = buffered.indexOf("\n");
      }
      if (buffered.length > MAX_LINE) this.reset(child);
    });
  }

  message(child: ChildProcessWithoutNullStreams, message: Message) {
    const job = this.job;
    if (this.child !== child || !job) return;
    if (message.kind === "done") {
      this.finish();
    } else if (!job.abort.signal.aborted && message.kind === "candidate") {
      if (++job.candidates > 8) {
        this.reset(child);
        return;
      }
      if (typeof message.url === "string" && message.url.length <= 8192) {
        job.candidate({ url: message.url, noReferrer: message.noReferrer === true });
      }
    } else if (!job.abort.signal.aborted && message.kind === "fetch") {
      if (++job.calls > 32 || !Number.isSafeInteger(message.id)) {
        this.reset(child);
        return;
      }
      const send = (result: Message) => {
        if (this.child === child && this.job === job && !job.abort.signal.aborted) {
          this.send({ kind: "fetch-result", id: message.id, ...result });
        }
      };
      void relay(message, job.abort.signal).then(send, () => send({ error: true }));
    }
  }

  send(message: Message) {
    this.child?.stdin.write(JSON.stringify(message) + "\n");
  }

  finish() {
    clearTimeout(this.stopTimer);
    const job = this.job;
    this.job = undefined;
    job?.abort.abort();
    job?.finish();
    const child = this.child;
    if (child) this.idleTimer = setTimeout(() => this.reset(child), WORKER_IDLE_TIMEOUT);
  }

  reset(child: ChildProcessWithoutNullStreams) {
    if (this.child !== child) return;
    clearTimeout(this.idleTimer);
    this.child = undefined;
    child.kill("SIGKILL");
    this.finish();
  }

  cancel(job: Job) {
    const child = this.child;
    if (this.job !== job || !child || job.abort.signal.aborted) return;
    job.abort.abort();
    this.send({ kind: "stop" });
    this.stopTimer = setTimeout(() => this.reset(child), 500);
  }
}

const token = process.env.VIDCORE_RESOLVER_TOKEN;
if (!token || !/^[\x00-\x7f]{32,}$/.test(token)) throw new Error("Invalid resolver token.");
const expected = Buffer.from("Bearer " + token);
const slots = [new Slot(), new Slot()];
const mediaId = /^[1-9][0-9]{0,11}$/;
const coordinate = /^[1-9][0-9]{0,4}$/;

const server = createServer(async (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  const auth = Buffer.from(request.headers.authorization ?? "");
  if (auth.length !== expected.length || !timingSafeEqual(auth, expected)) {
    response.writeHead(401).end();
    return;
  }
  if (request.method !== "POST" || request.url !== "/resolve") {
    response.writeHead(404).end();
    return;
  }
  let payload: Message;
  try {
    let text = "";
    request.setEncoding("utf8");
    for await (const chunk of request) {
      text += chunk;
      if (Buffer.byteLength(text) > 1024) throw new Error("Request too large.");
    }
    payload = JSON.parse(text);
    if (!payload || (payload.type !== "movie" && payload.type !== "tv") || !mediaId.test(String(payload.id)) ||
        (payload.type === "tv" && (!coordinate.test(String(payload.season)) || !coordinate.test(String(payload.episode))))) {
      throw new Error("Invalid media.");
    }
  } catch {
    response.writeHead(400).end();
    return;
  }

  const slot = slots.find((candidate) => !candidate.job);
  if (!slot) {
    response.writeHead(503).end();
    return;
  }
  try {
    if (!slot.child) slot.start();
  } catch {
    response.writeHead(502).end();
    return;
  }
  const job: Job = {
    abort: new AbortController(),
    calls: 0,
    candidates: 0,
    candidate: (value) => response.write(JSON.stringify(value) + "\n"),
    finish: () => {
      clearTimeout(deadline);
      response.end();
    },
  };
  const deadline = setTimeout(() => {
    slot.cancel(job);
    response.end();
  }, EXTRACT_TIMEOUT);
  clearTimeout(slot.idleTimer);
  slot.job = job;
  response.on("close", () => slot.cancel(job));
  response.writeHead(200, { "Content-Type": "application/x-ndjson" });
  response.flushHeaders();
  slot.send({ kind: "resolve", type: payload.type, id: String(payload.id), season: String(payload.season), episode: String(payload.episode) });
});

server.requestTimeout = 5_000;
server.headersTimeout = 5_000;
server.listen(Number(process.env.VIDCORE_RESOLVER_PORT || 3040), process.env.VIDCORE_RESOLVER_HOST || "127.0.0.1");
