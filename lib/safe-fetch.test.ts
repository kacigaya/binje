import { afterEach, expect, mock, spyOn, test } from "bun:test";
import * as dns from "node:dns/promises";
import { fetchPublic, isSafeHost } from "./safe-fetch";

afterEach(() => { mock.restore(); });

test("aborts DNS validation and removes the pending lookup from cache", async () => {
  const lookup = spyOn(dns, "lookup").mockImplementation(() => new Promise<never>(() => {}));
  const controller = new AbortController();
  const pending = fetchPublic("https://deadline-fixture.test/stream", { signal: controller.signal });
  controller.abort(new Error("DNS deadline"));
  await expect(pending).rejects.toThrow("DNS deadline");
  expect(lookup).toHaveBeenCalledTimes(1);
  lookup.mockRejectedValue(new Error("DNS failure"));
  expect(await isSafeHost(new URL("https://deadline-fixture.test/stream"))).toBe(false);
  expect(lookup).toHaveBeenCalledTimes(2);
});
