/**
 * Drives Chrome tab mirroring over CDP.
 *
 * One browser-level connection is shared by every request. It is attached to a
 * single page target, kept alive while casting, and torn down after an idle
 * period so the companion does not hold a DevTools session forever.
 */

import type { CdpConnection, CdpEvent } from "./cdp";
import { parseTargets, selectCastTarget } from "./chrome";

const DISCOVERY_TIMEOUT_MS = 2500;
const CONFIRM_TIMEOUT_MS = 1500;
const IDLE_TIMEOUT_MS = 60_000;

export type CastSink = { name: string; active: boolean };
export type CastStatus = { casting: boolean; sinkName: string | null };

export type CastErrorCode =
  | "chrome-unavailable"
  | "tab-not-found"
  | "sink-unavailable"
  | "already-casting"
  | "cast-failed";

export class CastError extends Error {
  readonly code: CastErrorCode;
  constructor(code: CastErrorCode, message: string) {
    super(message);
    this.name = "CastError";
    this.code = code;
  }
}

type Session = {
  connection: CdpConnection;
  sessionId: string;
  targetId: string;
  sinks: CastSink[];
  lastIssue: string | null;
  disposed: boolean;
  dispose: () => void;
};

export type CastController = {
  status(): CastStatus;
  listSinks(tabUrl: string | null): Promise<CastSink[]>;
  start(sinkName: string, tabUrl: string | null): Promise<CastStatus>;
  stop(sinkName: string | null): Promise<CastStatus>;
  close(): Promise<void>;
};

export type CastControllerOptions = {
  allowedOrigins: readonly string[];
  /** Opens a browser-level CDP connection. Throws when Chrome is unreachable. */
  connect: () => Promise<CdpConnection>;
  discoveryTimeoutMs?: number;
  confirmTimeoutMs?: number;
  idleTimeoutMs?: number;
};

function parseSinks(params: Record<string, unknown>): CastSink[] {
  const raw = Array.isArray(params.sinks) ? params.sinks : [];
  const sinks: CastSink[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const sink = entry as { name?: unknown; session?: unknown };
    if (typeof sink.name !== "string" || sink.name === "") continue;
    if (sinks.some((existing) => existing.name === sink.name)) continue;
    sinks.push({ name: sink.name, active: typeof sink.session === "string" && sink.session !== "" });
  }
  return sinks;
}

export function createCastController({
  allowedOrigins,
  connect,
  discoveryTimeoutMs = DISCOVERY_TIMEOUT_MS,
  confirmTimeoutMs = CONFIRM_TIMEOUT_MS,
  idleTimeoutMs = IDLE_TIMEOUT_MS,
}: CastControllerOptions): CastController {
  let session: Session | null = null;
  let connecting: Promise<Session> | null = null;
  let casting: { sinkName: string; confirmed: boolean } | null = null;
  /** Sink a `start` call has claimed but not yet handed to Chrome. */
  let starting: string | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  const waiters = new Set<() => void>();

  function notify() {
    for (const waiter of [...waiters]) waiter();
  }

  function status(): CastStatus {
    return { casting: casting !== null, sinkName: casting?.sinkName ?? null };
  }

  function waitFor(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
    if (predicate()) return Promise.resolve(true);
    return new Promise((resolve) => {
      const deadline: { timer: ReturnType<typeof setTimeout> | undefined } = { timer: undefined };
      const check = () => {
        if (!predicate()) return;
        clearTimeout(deadline.timer);
        waiters.delete(check);
        resolve(true);
      };
      deadline.timer = setTimeout(() => {
        waiters.delete(check);
        resolve(false);
      }, timeoutMs);
      waiters.add(check);
    });
  }

  function handleEvent(target: Session, event: CdpEvent) {
    // Sinks are recorded from the moment the session is attached, including the
    // window before `createSession` publishes it, so early discovery is not lost.
    if (target.disposed) return;

    if (event.method === "Cast.sinksUpdated" && event.sessionId === target.sessionId) {
      target.sinks = parseSinks(event.params);
      if (casting && session === target) {
        const active = target.sinks.find((sink) => sink.name === casting?.sinkName)?.active ?? false;
        // Only trust a missing route once Chrome has confirmed the route existed,
        // otherwise the update that races `startTabMirroring` looks like a stop.
        if (active) casting.confirmed = true;
        else if (casting.confirmed) casting = null;
      }
      notify();
      return;
    }

    if (event.method === "Cast.issueUpdated" && event.sessionId === target.sessionId) {
      const issue = event.params.issueMessage;
      target.lastIssue = typeof issue === "string" && issue !== "" ? issue : null;
      // An issue on a route Chrome already confirmed means mirroring ended.
      // Issues that land while `start` is still waiting are its own to report.
      if (target.lastIssue && session === target && casting?.confirmed) casting = null;
      notify();
      return;
    }

    if (
      event.method === "Target.detachedFromTarget" &&
      event.params.sessionId === target.sessionId &&
      session === target
    ) {
      // The mirrored tab closed or navigated away from the app.
      void dropSession(false);
    }
  }

  async function dropSession(disableCast: boolean) {
    const current = session;
    session = null;
    casting = null;
    if (!current) {
      notify();
      return;
    }
    if (disableCast) {
      await current.connection
        .send("Cast.disable", {}, current.sessionId)
        .catch(() => undefined);
    }
    current.dispose();
    current.connection.close();
    notify();
  }

  async function createSession(tabUrl: string | null): Promise<Session> {
    const connection = await connect();
    let created: Session | null = null;
    try {
      const targets = parseTargets(await connection.send("Target.getTargets"));
      const target = selectCastTarget(targets, allowedOrigins, tabUrl);
      if (!target) {
        throw new CastError("tab-not-found", "No b!nje tab is open in this Chrome instance.");
      }

      const attached = await connection.send("Target.attachToTarget", {
        targetId: target.targetId,
        flatten: true,
      });
      const sessionId = typeof attached.sessionId === "string" ? attached.sessionId : "";
      if (!sessionId) {
        throw new CastError("chrome-unavailable", "Chrome refused to attach to the tab.");
      }

      created = {
        connection,
        sessionId,
        targetId: target.targetId,
        sinks: [],
        lastIssue: null,
        disposed: false,
        dispose: () => undefined,
      };
      const boundSession = created;
      const offEvent = connection.onEvent((event) => handleEvent(boundSession, event));
      const offClose = connection.onClose(() => {
        if (session === boundSession) void dropSession(false);
      });
      created.dispose = () => {
        boundSession.disposed = true;
        offEvent();
        offClose();
      };

      try {
        await connection.send("Cast.enable", {}, sessionId);
      } catch (error) {
        throw new CastError(
          "chrome-unavailable",
          error instanceof Error ? error.message : "Chrome could not start Cast discovery.",
        );
      }

      session = created;
      return created;
    } catch (error) {
      created?.dispose();
      connection.close();
      throw error;
    }
  }

  function ensureSession(tabUrl: string | null): Promise<Session> {
    if (session) return Promise.resolve(session);
    if (!connecting) {
      const attempt = createSession(tabUrl);
      connecting = attempt;
      void attempt
        .catch(() => undefined)
        .then(() => {
          if (connecting === attempt) connecting = null;
        });
    }
    return connecting;
  }

  function touch() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      idleTimer = null;
      if (!casting) void dropSession(true);
    }, idleTimeoutMs);
  }

  async function listSinks(tabUrl: string | null): Promise<CastSink[]> {
    touch();
    const current = await ensureSession(tabUrl);
    if (current.sinks.length === 0) {
      await waitFor(() => session !== current || current.sinks.length > 0, discoveryTimeoutMs);
    }
    return current.sinks;
  }

  return {
    status,
    listSinks,

    async start(sinkName, tabUrl) {
      touch();
      // Claimed before the first await so two concurrent calls cannot both pass
      // this check and hand Chrome two mirroring commands.
      const claimed = casting?.sinkName ?? starting;
      if (claimed !== null && claimed !== sinkName) {
        throw new CastError("already-casting", `This tab is already casting to ${claimed}.`);
      }
      starting = sinkName;
      try {
        return await startMirroring(sinkName, tabUrl);
      } finally {
        if (starting === sinkName) starting = null;
      }
    },

    async stop(sinkName) {
      touch();
      const active = casting?.sinkName ?? null;
      // Nothing to end, or a stale caller naming a device this tab is not
      // casting to. Neither may clear a session that is still running.
      if (active === null || (sinkName !== null && sinkName !== active)) return status();

      const current = session;
      if (!current) {
        casting = null;
        return status();
      }
      try {
        await current.connection.send("Cast.stopCasting", { sinkName: active }, current.sessionId);
      } catch (error) {
        // Chrome is probably still mirroring, so keep the state that lets the
        // caller retry instead of reporting a stop that did not happen.
        throw new CastError(
          "cast-failed",
          error instanceof Error ? error.message : "Chrome could not stop tab mirroring.",
        );
      }
      casting = null;
      return status();
    },

    async close() {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = null;
      await dropSession(true);
    },
  };

  async function startMirroring(sinkName: string, tabUrl: string | null): Promise<CastStatus> {
    const current = await ensureSession(tabUrl);
    const sinks = current.sinks.length > 0 ? current.sinks : await listSinks(tabUrl);
    if (!sinks.some((sink) => sink.name === sinkName)) {
      throw new CastError("sink-unavailable", "That Cast device is no longer available.");
    }

    current.lastIssue = null;
    try {
      await current.connection.send("Cast.startTabMirroring", { sinkName }, current.sessionId);
    } catch (error) {
      throw new CastError(
        "cast-failed",
        error instanceof Error ? error.message : "Chrome could not start tab mirroring.",
      );
    }

    if (session !== current) {
      throw new CastError("cast-failed", "The Chrome connection dropped while starting.");
    }
    casting = { sinkName, confirmed: false };
    // Chrome resolves the command before the receiver answers, so wait for
    // either a route on the sink or an issue report before claiming success.
    await waitFor(
      () => current.lastIssue !== null || casting === null || casting.confirmed,
      confirmTimeoutMs,
    );
    if (current.lastIssue) {
      const issue = current.lastIssue;
      casting = null;
      throw new CastError("cast-failed", issue);
    }
    return status();
  }
}
