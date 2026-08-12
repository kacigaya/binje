import { expect, test } from "bun:test";
import { createTtlCache } from "@/lib/ttl-cache";

test("TTL cache coalesces concurrent loads", async () => {
  const cache = createTtlCache<number>(1000);
  let loads = 0;
  const load = async () => ++loads;

  const [first, second] = await Promise.all([
    cache.get("movie:1", load),
    cache.get("movie:1", load),
  ]);

  expect(first).toBe(1);
  expect(second).toBe(1);
  expect(loads).toBe(1);
});
