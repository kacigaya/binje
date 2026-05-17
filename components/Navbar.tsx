"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Search, Film, X } from "lucide-react";
import { useState, useRef, SyntheticEvent, useEffect, useCallback } from "react";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

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

        {!pathname.startsWith("/search") && (
        <div className="flex items-center">
          {open ? (
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search movies & TV..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-9 w-56 sm:w-72 rounded-full bg-white/8 border border-white/15 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent-red/50 focus:border-accent-red/50 transition-all"
                />
              </div>
              <button
                type="button"
                onClick={close}
                className="flex items-center justify-center h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/8 transition-colors cursor-pointer"
                aria-label="Close search"
              >
                <X className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <button
              onClick={() => setOpen(true)}
              className="flex items-center justify-center h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/8 transition-colors cursor-pointer"
              aria-label="Open search"
            >
              <Search className="h-5 w-5" />
            </button>
          )}
        </div>
        )}
      </div>
    </nav>
  );
}
