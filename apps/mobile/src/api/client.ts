const DEFAULT_TIMEOUT_MS = 15_000;

type QueryValue = string | number | boolean | null | undefined;

type ApiRequestOptions = {
  baseUrl?: string;
  query?: Record<string, QueryValue>;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("EXPO_PUBLIC_API_BASE_URL must be a valid HTTP URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("EXPO_PUBLIC_API_BASE_URL must be a valid HTTP URL.");
  }
  return trimmed;
}

function configuredBaseUrl(): string {
  return normalizeBaseUrl(
    process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://binje-stream.netlify.app",
  );
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? configuredBaseUrl());
  const url = new URL(path.startsWith("/") ? path : `/${path}`, `${baseUrl}/`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }

  const controller = new AbortController();
  const onAbort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", onAbort, { once: true });
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      const error =
        payload && typeof payload === "object" && "error" in payload
          ? (payload as { error?: { code?: unknown; message?: unknown } }).error
          : undefined;
      const message =
        typeof error?.message === "string"
          ? error.message
          : `Request failed with status ${response.status}.`;
      throw new ApiError(
        message,
        response.status,
        typeof error?.code === "string" ? error.code : undefined,
      );
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", onAbort);
  }
}
