import { afterEach, describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { browseDependencies, GET } from "./route";
const original = { ...browseDependencies }; afterEach(() => Object.assign(browseDependencies, original));
describe("mobile browse route", () => {
  test("loads a valid category", async () => { browseDependencies.getPopular = async () => []; const response = await GET(new NextRequest("http://localhost/api/mobile/browse?type=movie&category=popular&page=2&lang=en")); expect(response.status).toBe(200); expect(await response.json()).toEqual({ page: 2, items: [] }); expect(response.headers.get("netlify-vary")).toBe("query"); });
  test("rejects invalid media type and category", async () => { expect((await GET(new NextRequest("http://localhost/api/mobile/browse?type=person&category=popular"))).status).toBe(400); expect((await GET(new NextRequest("http://localhost/api/mobile/browse?type=movie&category=on-the-air"))).status).toBe(400); });
});
