"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { Search, Film, X, Clapperboard, Tv, Bookmark } from "lucide-react";
import { useState, useRef, SyntheticEvent, useEffect, useCallback } from "react";
import { Input } from "@base-ui/react/input";
import { Button } from "@base-ui/react/button";

interface SearchSuggestion {
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

const navLinks = [
  { href: "/movies", label: "Movies", icon: Clapperboard },
  { href: "/tv-shows", label: "TV Shows", icon: Tv },
  { href: "/watchlist", label: "Watchlist", icon: Bookmark },
];

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSuggestions([]);
  }, []);

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (!open || trimmedQuery.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(trimmedQuery)}`,
          { signal: controller.signal },
        );

        if (!res.ok) {
          setSuggestions([]);
          return;
        }

        const data: SearchSuggestionsResponse = await res.json();
        setSuggestions((data.results ?? []).slice(0, 3));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setSuggestions([]);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      close();
    }
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setSuggestions([]);
    }
  }

  function openSuggestion(suggestion: SearchSuggestion) {
    const href =
      suggestion.media_type === "tv"
        ? `/tv/${suggestion.id}`
        : `/movie/${suggestion.id}`;
    router.push(href);
    close();
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/50 backdrop-blur-xl border-b border-white/5">
      <div className="mx-auto max-w-7xl flex items-center justify-between px-4 sm:px-6 h-16">
        <Link
          href="/"
          className="flex items-center gap-2 text-xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          <Film className="h-6 w-6 text-accent-red" />
          <span className="text-foreground">
            b<span className="text-accent-red">!</span>nje
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          {!open && (
            <div className="flex items-center gap-1">
              {navLinks.map((link) => {
                const active = pathname === link.href;
                const Icon = link.icon;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
                      active
                        ? "bg-white/10 text-foreground"
                        : "text-muted-foreground hover:bg-white/8 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          )}

          {!pathname.startsWith("/search") && (
            <div className="flex items-center">
              {open ? (
                <form onSubmit={handleSubmit} className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      ref={inputRef}
                      type="text"
                      placeholder="Search movies & TV..."
                      value={query}
                      onValueChange={handleQueryChange}
                      className="h-9 w-56 sm:w-72 rounded-full bg-white/8 border border-white/15 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent-red/50 focus:border-accent-red/50 transition-all"
                    />
                    {suggestions.length > 0 && (
                      <div className="absolute right-0 top-12 w-72 overflow-hidden rounded-xl border border-white/10 bg-background/95 shadow-2xl shadow-black/40 backdrop-blur-xl">
                        {suggestions.map((suggestion) => {
                          const title =
                            suggestion.title ?? suggestion.name ?? "Untitled";
                          const date =
                            suggestion.release_date ?? suggestion.first_air_date;
                          const year = date ? new Date(date).getFullYear() : null;

                          return (
                            <button
                              key={`${suggestion.media_type}-${suggestion.id}`}
                              type="button"
                              onClick={() => openSuggestion(suggestion)}
                              className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/8 focus:bg-white/8 focus:outline-none"
                            >
                              <span className="relative h-12.5 w-8.5 shrink-0 overflow-hidden rounded bg-white/8">
                                {suggestion.poster_path ? (
                                  <Image
                                    src={`https://image.tmdb.org/t/p/w92${suggestion.poster_path}`}
                                    alt={title}
                                    fill
                                    className="object-cover"
                                    sizes="34px"
                                  />
                                ) : (
                                  <span className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-muted-foreground">
                                    {suggestion.media_type === "tv" ? "TV" : "M"}
                                  </span>
                                )}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-foreground">
                                  {title}
                                </span>
                                {year && (
                                  <span className="text-xs text-muted-foreground">
                                    {year}
                                  </span>
                                )}
                              </span>
                              <span className="ml-auto shrink-0 rounded-full bg-accent-red/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-red">
                                {suggestion.media_type === "tv" ? "TV" : "Movie"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    onClick={close}
                    className="flex items-center justify-center h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/8 transition-colors cursor-pointer"
                    aria-label="Close search"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </form>
              ) : (
                <Button
                  onClick={() => setOpen(true)}
                  className="flex items-center justify-center h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/8 transition-colors cursor-pointer"
                  aria-label="Open search"
                >
                  <Search className="h-5 w-5" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
