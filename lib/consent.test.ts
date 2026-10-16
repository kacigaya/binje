import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import CookiesBanner from "@/components/CookiesBanner";
import { getConsent, hasStorageConsent } from "./consent";

describe("consent server rendering", () => {
  test("does not include a banner before browser consent is known", () => {
    expect(renderToString(createElement(CookiesBanner))).toBe("");
  });

  test("does not grant storage consent on the server", () => {
    expect(getConsent()).toBeNull();
    expect(hasStorageConsent()).toBe(false);
  });
});
