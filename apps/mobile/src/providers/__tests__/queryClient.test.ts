import { ApiError } from "../../api/client";
import { shouldRetryRequest } from "../queryClient";

describe("query retry policy", () => {
  test("does not retry client errors", () => {
    expect(shouldRetryRequest(0, new ApiError("bad", 400))).toBe(false);
    expect(shouldRetryRequest(0, new ApiError("missing", 404))).toBe(false);
  });

  test("retries a server or network error at most twice", () => {
    expect(shouldRetryRequest(0, new ApiError("upstream", 502))).toBe(true);
    expect(shouldRetryRequest(1, new Error("offline"))).toBe(true);
    expect(shouldRetryRequest(2, new Error("offline"))).toBe(false);
  });
});
