"use client";

import Link from "next/link";
import { ExternalLink, Film } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-background/80">
      <div className="mx-auto max-w-7xl h-16 px-4 sm:px-6 flex items-center justify-between">
        <div
          className="flex items-center gap-2 text-sm text-muted-foreground"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          <Film className="h-4 w-4 text-accent-red" />
          <span className="font-bold tracking-tight text-foreground">
            b<span className="text-accent-red">!</span>nje
          </span>
        </div>

        <div className="flex items-center gap-4 sm:gap-6">
          <button
            type="button"
            onClick={() => {
              window.localStorage.removeItem("binje:cookie-consent");
              window.location.reload();
            }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Cookies
          </button>
          <Link
            href="/privacy"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Privacy
          </Link>
          <Link
            href="https://github.com/kacigaya/binje"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            GitHub
          </Link>
        </div>
      </div>
    </footer>
  );
}
