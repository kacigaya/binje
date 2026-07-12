import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";

export function shouldRetryRequest(failureCount: number, error: Error): boolean {
  if (failureCount >= 2) return false;
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return true;
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1_000,
        gcTime: 30 * 60 * 1_000,
        retry: shouldRetryRequest,
        refetchOnWindowFocus: false,
      },
    },
  });
}
