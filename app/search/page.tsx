"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, X, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

const API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;

interface SearchResult {
  id: number;
  media_type: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
}

type FilterType = "all" | "movie" | "tv";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") || "";
  const initialType = (searchParams.get("type") as FilterType) || "all";

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [filter, setFilter] = useState<FilterType>(initialType);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(q)}`,
      );
      const data = await res.json();
      setResults(
        (data.results || []).filter(
          (r: SearchResult) =>
            r.media_type === "movie" || r.media_type === "tv",
        ),
      );
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      doSearch(query);
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (filter !== "all") params.set("type", filter);
      const qs = params.toString();
      router.replace(`/search${qs ? `?${qs}` : ""}`, { scroll: false });
    }, 400);
    return () => clearTimeout(timer);
  }, [query, filter, doSearch, router]);

  useEffect(() => {
    if (initialQuery) {
      doSearch(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered =
    filter === "all" ? results : results.filter((r) => r.media_type === filter);

  return (
    <div className="pt-24 pb-16 px-4 sm:px-6 max-w-7xl mx-auto w-full">
      {/* Search input */}
      <div className="relative max-w-2xl mx-auto mb-8">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search movies & TV shows..."
          autoFocus
          className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 pl-13 pr-12 text-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber/50 focus:border-amber/50 transition-all"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {(["all", "movie", "tv"] as const).map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all cursor-pointer ${
              filter === type
                ? "bg-amber text-black"
                : "bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10"
            }`}
          >
            {type === "all" ? "All" : type === "movie" ? "Movies" : "TV Shows"}
          </button>
        ))}
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-2/3 rounded-xl" />
          ))}
        </div>
      )}

      {/* Results grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
          {filtered.map((item) => {
            const title = item.title || item.name || "Untitled";
            const date = item.release_date || item.first_air_date;
            const href =
              item.media_type === "tv" ? `/tv/${item.id}` : `/movie/${item.id}`;
            return (
              <Link
                key={`${item.media_type}-${item.id}`}
                href={href}
                className="group block"
              >
                <div className="relative aspect-2/3 overflow-hidden rounded-xl bg-card transition-all duration-300 group-hover:scale-[1.03] group-hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]">
                  {item.poster_path ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
                      alt={title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                      No Poster
                    </div>
                  )}
                  <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  {/* Rating */}
                  {item.vote_average != null && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-sm px-2 py-0.5 text-xs font-semibold text-amber">
                      <Star className="h-3 w-3 fill-amber" />
                      {item.vote_average.toFixed(1)}
                    </div>
                  )}

                  {/* Media type badge */}
                  {item.media_type === "tv" && (
                    <div className="absolute top-2 left-2 rounded-full bg-amber/90 px-2 py-0.5 text-[10px] font-bold text-black uppercase tracking-wider">
                      TV
                    </div>
                  )}

                  {/* Title on hover */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <p className="text-sm font-semibold text-white leading-tight line-clamp-2">
                      {title}
                    </p>
                    {date && (
                      <p className="text-xs text-white/60 mt-1">
                        {new Date(date).getFullYear()}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && searched && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Search className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3
            className="text-xl font-semibold mb-2"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            No results found
          </h3>
          <p className="text-muted-foreground">
            Try a different search term or check the spelling.
          </p>
        </div>
      )}

      {/* Initial state */}
      {!loading && !searched && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Search className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3
            className="text-xl font-semibold mb-2"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Discover movies & TV shows
          </h3>
          <p className="text-muted-foreground">
            Start typing to search thousands of titles.
          </p>
        </div>
      )}
    </div>
  );
}
