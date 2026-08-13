"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";

export interface SearchSuggestion {
  id: number;
  media_type: "movie" | "tv";
  title?: string;
  name?: string;
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
}

interface SearchSuggestionsResponse {
  results?: SearchSuggestion[];
}

export const MIN_SUGGESTION_QUERY_LENGTH = 2;

export function suggestionTitle(suggestion: SearchSuggestion) {
  return suggestion.title ?? suggestion.name ?? "";
}

export function suggestionHref(suggestion: SearchSuggestion) {
  return suggestion.media_type === "tv"
    ? `/tv/${suggestion.id}`
    : `/movie/${suggestion.id}`;
}

export function useSearchSuggestions({
  query,
  locale,
  enabled = true,
  limit = 3,
}: {
  query: string;
  locale: Locale;
  enabled?: boolean;
  limit?: number;
}) {
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (!enabled || trimmedQuery.length < MIN_SUGGESTION_QUERY_LENGTH) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(trimmedQuery)}&lang=${locale}&mode=suggestions`,
          { signal: controller.signal },
        );

        if (!res.ok) {
          setSuggestions([]);
          return;
        }

        const data: SearchSuggestionsResponse = await res.json();
        setSuggestions((data.results ?? []).slice(0, limit));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, limit, locale, query]);

  return { suggestions, loading };
}
