import Image from "next/image";
import Link from "next/link";
import { Play, Star, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MediaItem } from "@/types/tmdb";
import { backdropUrl } from "@/lib/tmdb";

export default function Hero({ item }: { item: MediaItem }) {
  const backdrop = backdropUrl(item.backdrop_path);
  const detailHref =
    item.media_type === "tv" ? `/tv/${item.id}` : `/movie/${item.id}`;
  const watchHref =
    item.media_type === "tv" ? `/watch/tv/${item.id}` : `/watch/${item.id}`;

  return (
    <section className="relative w-full h-[70vh] sm:h-[80vh] overflow-hidden">
      {backdrop && (
        <Image
          src={backdrop}
          alt={item.title}
          fill
          priority
          className="object-cover object-top"
          sizes="100vw"
        />
      )}

      <div className="absolute inset-0 bg-linear-to-t from-background via-background/60 to-transparent" />
      <div className="absolute inset-0 bg-linear-to-t from-background/80 via-transparent to-transparent" />

      <div className="absolute inset-0 flex items-end">
        <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 pb-16 sm:pb-24">
          <div className="max-w-2xl space-y-4">
            <div className="flex items-center gap-3">
              <Badge
                variant="outline"
                className="border-amber/40 text-amber bg-amber/10 text-xs uppercase tracking-wider"
              >
                Trending
              </Badge>
              {item.media_type === "tv" && (
                <Badge className="bg-amber/90 text-black text-xs uppercase tracking-wider hover:bg-amber/80">
                  TV Series
                </Badge>
              )}
              <div className="flex items-center gap-1 text-amber">
                <Star className="h-4 w-4 fill-amber" />
                <span className="text-sm font-semibold">
                  {item.vote_average.toFixed(1)}
                </span>
              </div>
              {item.date && (
                <span className="text-sm text-muted-foreground">
                  {new Date(item.date).getFullYear()}
                </span>
              )}
            </div>

            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-none"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {item.title}
            </h1>

            <p className="text-base sm:text-lg text-foreground/70 line-clamp-3 leading-relaxed max-w-xl">
              {item.overview}
            </p>

            <div className="flex items-center gap-3 pt-2">
              <Link href={watchHref}>
                <Button
                  size="lg"
                  className="rounded-full bg-amber text-black font-semibold hover:bg-amber/90 gap-2 px-8 h-12 text-base cursor-pointer"
                >
                  <Play className="h-5 w-5 fill-black" />
                  Watch Now
                </Button>
              </Link>
              <Link href={detailHref}>
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full border-white/20 bg-white/5 hover:bg-white/10 text-foreground gap-2 px-8 h-12 text-base cursor-pointer"
                >
                  <Info className="h-5 w-5" />
                  Details
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
