"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Film } from "lucide-react";
import { useState, SyntheticEvent } from "react";

export default function Navbar() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass">
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

        <div className="flex items-center gap-6">
          <div className="hidden sm:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <Link
              href="/search"
              className="hover:text-foreground transition-colors"
            >
              Movies
            </Link>
            <Link
              href="/search?type=tv"
              className="hover:text-foreground transition-colors"
            >
              TV Shows
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search movies & TV..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 w-44 sm:w-56 rounded-full bg-white/5 border border-white/10 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent-red/50 focus:border-accent-red/50 transition-all"
            />
          </form>
        </div>
      </div>
    </nav>
  );
}
