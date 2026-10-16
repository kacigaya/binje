import { expect, test } from "bun:test";
import { Agent } from "undici";
import { dispatcherFor } from "@/lib/safe-fetch";

test("dispatcherFor routes only Atlantic-referred requests through the stream proxy", () => {
  const proxy = new Agent();
  const direct = dispatcherFor(undefined, proxy);
  expect(direct).not.toBe(proxy);
  expect(dispatcherFor({ referer: "https://atlantic.st/" }, proxy)).toBe(proxy);
  expect(dispatcherFor(new Headers({ Referer: "https://atlantic.st/watch/1" }), proxy)).toBe(proxy);
  expect(dispatcherFor({ referer: "https://atlantic.st.evil.test/" }, proxy)).toBe(direct);
  expect(dispatcherFor({ referer: "https://vidrock.net/" }, proxy)).toBe(direct);
  expect(dispatcherFor({ referer: "not a url" }, proxy)).toBe(direct);
  expect(dispatcherFor({ referer: "https://atlantic.st/" }, undefined)).toBe(direct);
});
