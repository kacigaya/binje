import { expect, test } from "bun:test";
import { sourceMenu } from "@/lib/source-menu";

const all = ["a", "b", "c", "d"] as const;

test("lists probed sources first and flags the rest last", () => {
  expect(sourceMenu(all, ["c", "a"], [], "c")).toEqual([
    { id: "c", unavailable: false },
    { id: "a", unavailable: false },
    { id: "b", unavailable: true },
    { id: "d", unavailable: true },
  ]);
});

test("flags sources that failed here, except the one being tried", () => {
  expect(sourceMenu(all, ["a", "b"], ["a", "d"], "d")).toEqual([
    { id: "b", unavailable: false },
    { id: "d", unavailable: false },
    { id: "a", unavailable: true },
    { id: "c", unavailable: true },
  ]);
});

test("flags nothing but failures while probing or after a failed probe", () => {
  for (const available of [undefined, null]) {
    expect(sourceMenu(all, available, ["b"], "a").map(({ id, unavailable }) => `${id}${unavailable ? "!" : ""}`))
      .toEqual(["a", "c", "d", "b!"]);
  }
});

test("ignores ids this build does not know", () => {
  expect(sourceMenu(["a", "b"] as string[], ["zzz", "b"], [], null).map(({ id }) => id)).toEqual(["b", "a"]);
});
