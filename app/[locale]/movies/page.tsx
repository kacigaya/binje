import type { Metadata } from "next";
import { Clapperboard } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import Carousel from "@/components/Carousel";
import LazyCarousel from "@/components/LazyCarousel";
import {
  getTrending,
  movieToMedia,
} from "@/lib/tmdb";
import { translate, type Locale } from "@/lib/i18n";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: translate(locale, "Movies") };
}

export default async function MoviesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const trending = await getTrending(locale);
  const sections = [
    ["Popular Movies", "popular"],
    ["Top Rated Movies", "top-rated"],
    ["Now Playing", "now-playing"],
    ["Upcoming", "upcoming"],
    ["Action", "genre-28"],
    ["Comedy", "genre-35"],
    ["Drama", "genre-18"],
    ["Horror", "genre-27"],
    ["Sci-Fi", "genre-878"],
  ] as const;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 pb-16 pt-24 sm:pt-28">
      <header className="px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Clapperboard className="size-7 text-accent-red sm:h-8 sm:w-8" />
          <h1
            className="text-2xl font-bold tracking-tight sm:text-3xl text-balance"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {translate(locale, "Movies")}
          </h1>
        </div>
        <Separator className="mt-5 bg-white/10" />
      </header>

      <Carousel
        title={translate(locale, "Trending Movies")}
        items={trending.map(movieToMedia)}
        priority
      />
      {sections.map(([title, category]) => (
        <LazyCarousel
          key={title}
          title={translate(locale, title)}
          src={`/api/browse?type=movie&category=${category}&lang=${locale}`}
        />
      ))}
    </div>
  );
}
