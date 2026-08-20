/**
 * Minimal Chrome DevTools Protocol client.
 *
 * Only what the cast flow needs: request/response correlation, flat session
 * events, and a hard guarantee that pending calls settle when the socket dies.
 * No dependency on a CDP library — the protocol is JSON over one WebSocket.
 */

const CALL_TIMEOUT_MS = 10_000;

export type CdpEvent = {
  method: string;
  sessionId: string | undefined;
  params: Record<string, unknown>;
};

/** Transport seam so tests can drive the protocol without a real socket. */
export type CdpSocket = {
  send(data: string): void;
  close(): void;
  onOpen(listener: () => void): void;
  onMessage(listener: (data: string) => void): void;
  onClose(listener: () => void): void;
  onError(listener: (message: string) => void): void;
};

export type CdpConnection = {
  send(
    method: string,
    params?: Record<string, unknown>,
    sessionId?: string,
  ): Promise<Record<string, unknown>>;
  onEvent(listener: (event: CdpEvent) => void): () => void;
  onClose(listener: () => void): () => void;
  close(): void;
};

type PendingCall = {
  resolve: (result: Record<string, unknown>) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export function webSocketAdapter(url: string): CdpSocket {
  const socket = new WebSocket(url);
  return {
    send: (data) => socket.send(data),
    close: () => socket.close(),
    onOpen: (listener) => socket.addEventListener("open", () => listener()),
    onMessage: (listener) =>
      socket.addEventListener("message", (event: MessageEvent) => {
        if (typeof event.data === "string") listener(event.data);
      }),
    onClose: (listener) => socket.addEventListener("close", () => listener()),
    onError: (listener) => socket.addEventListener("error", () => listener("CDP socket error.")),
  };
}

export function openCdpConnection(
  socket: CdpSocket,
  callTimeoutMs = CALL_TIMEOUT_MS,
): Promise<CdpConnection> {
  return new Promise((resolveConnection, rejectConnection) => {
    const pending = new Map<number, PendingCall>();
    const eventListeners = new Set<(event: CdpEvent) => void>();
    const closeListeners = new Set<() => void>();
    let nextId = 0;
    let opened = false;
    let closed = false;

    const teardown = (reason: string) => {
      if (closed) return;
      closed = true;
      for (const call of pending.values()) {
        clearTimeout(call.timer);
        call.reject(new Error(reason));
      }
      pending.clear();
      const listeners = [...closeListeners];
      closeListeners.clear();
      eventListeners.clear();
      if (!opened) rejectConnection(new Error(reason));
      for (const listener of listeners) listener();
    };

    const connection: CdpConnection = {
      send(method, params, sessionId) {
        if (closed) return Promise.reject(new Error("CDP connection closed."));
        const id = ++nextId;
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            pending.delete(id);
            reject(new Error(`CDP command timed out: ${method}`));
          }, callTimeoutMs);
          pending.set(id, { resolve, reject, timer });
          try {
            socket.send(
              JSON.stringify({
                id,
                method,
                ...(params ? { params } : {}),
                ...(sessionId ? { sessionId } : {}),
              }),
            );
          } catch (error) {
            pending.delete(id);
            clearTimeout(timer);
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        });
      },
      onEvent(listener) {
        eventListeners.add(listener);
        return () => eventListeners.delete(listener);
      },
      onClose(listener) {
        if (closed) {
          listener();
          return () => undefined;
        }
        closeListeners.add(listener);
        return () => closeListeners.delete(listener);
      },
      close() {
        socket.close();
        teardown("CDP connection closed.");
      },
    };

    socket.onMessage((data) => {
      let frame: unknown;
      try {
        frame = JSON.parse(data);
      } catch {
        return;
      }
      if (typeof frame !== "object" || frame === null) return;
      const message = frame as {
        id?: unknown;
        result?: unknown;
        error?: { message?: unknown };
        method?: unknown;
        params?: unknown;
        sessionId?: unknown;
      };

      if (typeof message.id === "number") {
        const call = pending.get(message.id);
        if (!call) return;
        pending.delete(message.id);
        clearTimeout(call.timer);
        if (message.error) {
          const detail =
            typeof message.error.message === "string" ? message.error.message : "CDP command failed.";
          call.reject(new Error(detail));
        } else {
          call.resolve((message.result ?? {}) as Record<string, unknown>);
        }
        return;
      }

      if (typeof message.method !== "string") return;
      const event: CdpEvent = {
        method: message.method,
        sessionId: typeof message.sessionId === "string" ? message.sessionId : undefined,
        params: (message.params ?? {}) as Record<string, unknown>,
      };
      for (const listener of [...eventListeners]) listener(event);
    });

    socket.onError((message) => {
      // Tear down first: the close event that follows would otherwise replace
      // the real reason with a generic one.
      teardown(message || "CDP socket error.");
      socket.close();
    });
    socket.onClose(() => teardown("CDP connection closed."));
    socket.onOpen(() => {
      if (closed) return;
      opened = true;
      resolveConnection(connection);
    });
  });
}
