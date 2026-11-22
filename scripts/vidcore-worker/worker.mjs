import { createInterface } from "node:readline";
import { candidates } from "./extract.mjs";

const input = createInterface({ input: process.stdin });
const pending = new Map();
const emit = (data) => process.stdout.write(JSON.stringify(data) + "\n");
let nextId = 0;
let run;

globalThis.fetch = async (url, options) => {
  if (!run || run.signal.aborted) throw new Error("No active request.");
  const request = new Request(url, options);
  const signal = AbortSignal.any([run.signal, request.signal]);
  const id = ++nextId;
  const body = request.body ? await request.text() : undefined;
  signal.throwIfAborted();
  const result = await new Promise((resolve, reject) => {
    const abort = () => {
      pending.delete(id);
      reject(signal.reason);
    };
    signal.addEventListener("abort", abort, { once: true });
    pending.set(id, (message) => {
      signal.removeEventListener("abort", abort);
      resolve(message);
    });
    emit({ kind: "fetch", id, url: request.url, method: request.method, headers: Object.fromEntries(request.headers), body });
  });
  if (result.error) throw new Error("Vidcore request failed.");
  const data = result.body ? Buffer.from(result.body, "base64") : null;
  return new Response(data, { status: result.status });
};

input.on("line", async (line) => {
  const message = JSON.parse(line);
  if (message.kind === "fetch-result") {
    const complete = pending.get(message.id);
    pending.delete(message.id);
    complete?.(message);
    return;
  }
  if (message.kind === "stop") {
    run?.abort();
    return;
  }
  if (message.kind !== "resolve" || run) return;

  run = new AbortController();
  try {
    for await (const candidate of candidates(message.type, message.id, message.season, message.episode, run.signal)) {
      if (run.signal.aborted) break;
      emit({ kind: "candidate", ...candidate });
    }
  } catch {
  } finally {
    run.abort();
    run = undefined;
    emit({ kind: "done" });
  }
});
