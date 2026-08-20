/**
 * In-memory stand-in for Chrome's DevTools WebSocket, so the cast flow can be
 * exercised without a browser.
 */

import type { CdpSocket } from "./cdp";

export type SentCommand = {
  id: number;
  method: string;
  params: Record<string, unknown>;
  sessionId: string | undefined;
};

export type CommandHandler = (
  command: SentCommand,
) => Record<string, unknown> | Error | undefined;

export type FakeChrome = {
  socket: CdpSocket;
  sent: SentCommand[];
  handle(handler: CommandHandler): void;
  open(): void;
  emit(method: string, params: Record<string, unknown>, sessionId?: string): void;
  deliverRaw(data: string): void;
  respond(id: number, result: Record<string, unknown>): void;
  fail(id: number, message: string): void;
  drop(): void;
  raise(message: string): void;
  isClosed(): boolean;
};

export function createFakeChrome(): FakeChrome {
  const openListeners: (() => void)[] = [];
  const messageListeners: ((data: string) => void)[] = [];
  const closeListeners: (() => void)[] = [];
  const errorListeners: ((message: string) => void)[] = [];
  const sent: SentCommand[] = [];
  let handler: CommandHandler | null = null;
  let closed = false;

  function deliverRaw(data: string) {
    for (const listener of [...messageListeners]) listener(data);
  }

  function deliver(payload: unknown) {
    deliverRaw(JSON.stringify(payload));
  }

  function drop() {
    if (closed) return;
    closed = true;
    for (const listener of [...closeListeners]) listener();
  }

  const socket: CdpSocket = {
    send(data) {
      if (closed) throw new Error("Fake Chrome socket is closed.");
      const frame = JSON.parse(data) as {
        id: number;
        method: string;
        params?: Record<string, unknown>;
        sessionId?: string;
      };
      const command: SentCommand = {
        id: frame.id,
        method: frame.method,
        params: frame.params ?? {},
        sessionId: frame.sessionId,
      };
      sent.push(command);
      queueMicrotask(() => {
        if (closed || !handler) return;
        const result = handler(command);
        if (result === undefined) return;
        if (result instanceof Error) deliver({ id: command.id, error: { message: result.message } });
        else deliver({ id: command.id, result });
      });
    },
    close: drop,
    onOpen: (listener) => openListeners.push(listener),
    onMessage: (listener) => messageListeners.push(listener),
    onClose: (listener) => closeListeners.push(listener),
    onError: (listener) => errorListeners.push(listener),
  };

  return {
    socket,
    sent,
    handle: (next) => {
      handler = next;
    },
    open: () => {
      for (const listener of [...openListeners]) listener();
    },
    emit: (method, params, sessionId) => deliver({ method, params, ...(sessionId ? { sessionId } : {}) }),
    deliverRaw,
    respond: (id, result) => deliver({ id, result }),
    fail: (id, message) => deliver({ id, error: { message } }),
    drop,
    raise: (message) => {
      for (const listener of [...errorListeners]) listener(message);
    },
    isClosed: () => closed,
  };
}

/** Lets queued microtasks and short timers run before asserting. */
export function tick(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
