export const CAST_RENEWAL_MS = 4 * 60 * 1000;

export async function requestCastToken(source: string, subtitles: string[], signal?: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch("/api/cast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: source, subtitles }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Cast authorization failed.");
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !("token" in data) ||
      typeof data.token !== "string" || !/^[A-Za-z0-9_-]{32}$/.test(data.token)) {
      throw new Error("Invalid Cast authorization response.");
    }
    return data.token;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
