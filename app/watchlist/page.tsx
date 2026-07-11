import type { Metadata } from "next";
import { Bookmark } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import Watchlist from "@/components/Watchlist";

export const metadata: Metadata = {
  title: "My Watchlist",
  description: "Movies and TV shows you saved to watch later.",
};

export default function WatchlistPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-16 pt-24 sm:px-6 sm:pt-28">
      <div>
        <div className="flex items-center gap-3">
          <Bookmark className="h-7 w-7 text-accent-red sm:h-8 sm:w-8" />
          <h1
            className="text-2xl font-bold tracking-tight sm:text-3xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            My Watchlist
          </h1>
        </div>
        <Separator className="mt-5 bg-white/10" />
      </div>

      <Watchlist />
    </div>
  );
}
