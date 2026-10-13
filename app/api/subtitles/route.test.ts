import { expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { GET } from "./route";

test("rejects invalid titles before asking providers", async () => {
  const response = await GET(new NextRequest("http://localhost/api/subtitles?type=tv&id=x"));
  expect(response.status).toBe(400);
});
