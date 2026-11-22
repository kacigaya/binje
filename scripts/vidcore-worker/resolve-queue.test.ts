import { expect, test } from "bun:test";
import { createResolveQueue } from "./resolve-queue";
import { retryAt } from "./retry-after";

test("runs one extraction at a time and rejects excess requests", async () => {
  const acquire = createResolveQueue();
  const signal = new AbortController().signal;
  const first = await acquire(signal);
  expect(first).toBeDefined();
  const waiting = acquire(signal);
  expect(await acquire(signal)).toBeUndefined();

  first?.();
  const second = await waiting;
  expect(second).toBeDefined();
  const third = acquire(signal);
  expect(await acquire(signal)).toBeUndefined();
  second?.();
  (await third)?.();
  expect(await acquire(signal)).toBeDefined();
});

test("removes a disconnected waiter without releasing the active request", async () => {
  const acquire = createResolveQueue();
  const signal = new AbortController().signal;
  const disconnected = new AbortController();
  const first = await acquire(signal);
  expect(first).toBeDefined();
  const abandoned = acquire(disconnected.signal);
  disconnected.abort();
  expect(await abandoned).toBeUndefined();
  expect(await acquire(disconnected.signal)).toBeUndefined();

  const waiting = acquire(signal);
  expect(await acquire(signal)).toBeUndefined();
  first?.();
  const release = await waiting;
  expect(release).toBeDefined();
  release?.();
});

test("honors both forms of Retry-After and uses a bounded default", () => {
  const now = Date.UTC(2026, 10, 22);
  expect(retryAt("60", now)).toBe(now + 60_000);
  expect(retryAt("Sun, 22 Nov 2026 00:01:00 GMT", now)).toBe(now + 60_000);
  expect(retryAt(null, now)).toBe(now + 30_000);
  expect(retryAt("invalid", now)).toBe(now + 30_000);
});
