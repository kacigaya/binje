"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { XIcon } from "@/components/ui/x";
import { useAnimatedIcon } from "@/lib/use-animated-icon";
import Link from "next/link";
import MediaCard from "@/components/MediaCard";
import { Skeleton } from "@/components/ui/skeleton";
import { localizedHref } from "@/lib/i18n";
import type { MediaItem } from "@/types/tmdb";
import { useTranslations } from "@/lib/use-locale";

interface SearchResult {
  id: number;
  media_type: "movie" | "tv";
  title?: string;
  name?: string;
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
}

interface SearchApiResponse {
  results?: SearchResult[];
  page?: number;
  totalPages?: number;
  error?: string;
}

type FilterType = "all" | "movie" | "tv";

const FILTER_TYPES: readonly FilterType[] = ["all", "movie", "tv"] as const;

function toMediaItem(item: SearchResult, untitled: string): MediaItem {
  return {
    id: item.id,
    media_type: item.media_type,
    title: item.title || item.name || untitled,
    overview: "",
    poster_path: item.poster_path,
    backdrop_path: null,
    date: item.release_date || item.first_air_date || "",
    vote_average: item.vote_average ?? Number.NaN,
  };
}

function parseFilterType(value: string | null): FilterType {
  return FILTER_TYPES.includes(value as FilterType) ? (value as FilterType) : "all";
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="pt-24 pb-16 px-4 sm:px-6 max-w-7xl mx-auto w-full">
          <div className="relative max-w-2xl mx-auto mb-8">
            <Skeleton className="w-full h-14 rounded-2xl" />
          </div>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}

function SearchContent() {
  const { locale, t } = useTranslations();
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") || "";
  const initialType = parseFilterType(searchParams.get("type"));

  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const [clearIcon, clearFeedback] = useAnimatedIcon();
  const [results, setResults] = useState<SearchResult[]>([]);
  // A query in the URL means a search is about to run, so the first paint
  // shows its loading state rather than the "start typing" prompt.
  const [loading, setLoading] = useState(initialQuery.trim() !== "");
  const [searched, setSearched] = useState(initialQuery.trim() !== "");
  const [filter, setFilter] = useState<FilterType>(initialType);
  const [failed, setFailed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const doSearch = useCallback(async (q: string) => {
    abortRef.current?.abort();
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      setFailed(false);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setSearched(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&lang=${locale}`, {
        signal: controller.signal,
      });
      // A 400 is a query the API refuses (too long), which really has no
      // matches. Anything else failing must not read as "no matches".
      if (res.status === 400) {
        if (!controller.signal.aborted) setResults([]);
        return;
      }
      if (!res.ok) throw new Error("search");
      const data: SearchApiResponse = await res.json();
      if (!controller.signal.aborted) setResults(data.results ?? []);
    } catch {
      if (!controller.signal.aborted) {
        setResults([]);
        setFailed(true);
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [locale]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    const timer = setTimeout(() => {
      doSearch(query);
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (filter !== "all") params.set("type", filter);
      const qs = params.toString();
      router.replace(localizedHref(locale, `/search${qs ? `?${qs}` : ""}`), { scroll: false });
    }, 400);
    return () => clearTimeout(timer);
  }, [query, filter, doSearch, locale, router]);

  useEffect(() => {
    if (initialQuery) {
      doSearch(initialQuery);
    }
    // Autofocus only where a keyboard is already out: on a phone it throws up
    // the on-screen keyboard and scrolls the results out of view on arrival.
    if (window.matchMedia("(pointer: fine)").matches) {
      inputRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered =
    filter === "all" ? results : results.filter((r) => r.media_type === filter);

  return (
    <div className="pt-24 pb-16 px-4 sm:px-6 max-w-7xl mx-auto w-full">
      {/* The field itself is the page title visually; the heading gives the
          document an outline and a landmark to jump to. */}
      <h1 className="sr-only">{t("Search")}</h1>
      <div className="relative max-w-2xl mx-auto mb-8">
        <Search
          aria-hidden="true"
          className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-muted-foreground"
        />
        <input
          ref={inputRef}
          type="search"
          name="q"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Search movies & TV shows…")}
          aria-label={t("Search movies & TV shows…")}
          className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 pl-13 pr-12 text-lg [&::-webkit-search-cancel-button]:appearance-none text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/50 focus-visible:border-accent-red/50 transition"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            {...clearFeedback}
            aria-label={t("Clear search")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <XIcon ref={clearIcon} size={20} />
          </button>
        )}
      </div>

      <div role="group" aria-label={t("Results")} className="flex items-center justify-center gap-2 mb-8">
        {FILTER_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setFilter(type)}
            aria-pressed={filter === type}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60 ${
              filter === type
                ? "bg-accent-red text-white"
                : "bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10"
            }`}
          >
            {t(type === "all" ? "All" : type === "movie" ? "Movies" : "TV Shows")}
          </button>
        ))}
      </div>

      {loading && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="aspect-2/3 rounded-xl" />
              <Skeleton className="mt-2 h-4 w-3/4" />
              <Skeleton className="mt-1.5 h-3 w-1/2" />
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {filtered.map((item, index) => (
            <MediaCard
              key={`${item.media_type}-${item.id}`}
              item={toMediaItem(item, t("Untitled"))}
              eager={index < 6}
              className="w-full min-w-0"
            />
          ))}
        </div>
      )}

      {!loading && failed && (
        <div role="alert" className="flex flex-col items-center justify-center py-24 text-center">
          <h2
            className="text-xl font-semibold mb-2"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {t("Search is unavailable right now")}
          </h2>
          <p className="text-muted-foreground">
            {t("The search service did not respond. Your query is fine.")}
          </p>
          <button
            type="button"
            onClick={() => doSearch(query)}
            className="mt-6 inline-flex h-11 cursor-pointer items-center rounded-lg border border-white/15 px-6 text-sm font-semibold transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60"
          >
            {t("Try again")}
          </button>
        </div>
      )}

      {!loading && !failed && searched && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Search aria-hidden="true" className="size-12 text-muted-foreground/40 mb-4" />
          <h2
            className="text-xl font-semibold mb-2"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {t("No results found")}
          </h2>
          <p className="text-muted-foreground">
            {t("Try a different search term or check the spelling.")}
          </p>
          <Link
            href={localizedHref(locale, "/movies")}
            className="mt-6 inline-flex h-11 items-center rounded-lg border border-white/15 px-6 text-sm font-semibold transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60"
          >
            {t("Browse movies")}
          </Link>
        </div>
      )}

      {!loading && !searched && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Search aria-hidden="true" className="size-12 text-muted-foreground/40 mb-4" />
          <h2
            className="text-xl font-semibold mb-2"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {t("Search movies & TV shows")}
          </h2>
          <p className="text-muted-foreground">
            {t("Start typing to search thousands of titles.")}
          </p>
          <Link
            href={localizedHref(locale, "/movies")}
            className="mt-6 inline-flex h-11 items-center rounded-lg border border-white/15 px-6 text-sm font-semibold transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60"
          >
            {t("Browse movies")}
          </Link>
        </div>
      )}
    </div>
  );
}
