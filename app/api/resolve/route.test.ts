import { describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { GET } from "./route";

const VALID = "type=movie&id=37165&title=The%20Truman%20Show&year=1998";

describe("GET", () => {
  test("rejects missing metadata", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/resolve?type=movie&id=299534"),
    );

    expect(response.status).toBe(400);
  });

  test("rejects invalid TV episode numbers", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/resolve?type=tv&id=1399&title=Game%20of%20Thrones&year=2011&season=0&episode=1",
      ),
    );

    expect(response.status).toBe(400);
  });

  test("reports unconfigured storage without touching the network", async () => {
    const response = await GET(
      new NextRequest(`http://localhost/api/resolve?${VALID}`),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Library storage is not configured.",
    });
  });
});
