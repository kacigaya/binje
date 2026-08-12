import type { Metadata } from "next";
import { Tv } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import Carousel from "@/components/Carousel";
import LazyCarousel from "@/components/LazyCarousel";
import {
  getTrendingTV,
  tvToMedia,
} from "@/lib/tmdb";
import { translate, type Locale } from "@/lib/i18n";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: translate(locale, "TV Shows") };
}

export default async function TVShowsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const trending = await getTrendingTV(locale);
  const sections = [
    ["Popular TV Shows", "popular"],
    ["Top Rated TV Shows", "top-rated"],
    ["Airing Today", "airing-today"],
    ["On The Air", "on-the-air"],
    ["Action & Adventure", "genre-10759"],
    ["Comedy", "genre-35"],
    ["Drama", "genre-18"],
    ["Sci-Fi & Fantasy", "genre-10765"],
    ["Documentary", "genre-99"],
  ] as const;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 pb-16 pt-24 sm:pt-28">
      <header className="px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Tv className="size-7 text-accent-red sm:h-8 sm:w-8" />
          <h1
            className="text-2xl font-bold tracking-tight sm:text-3xl text-balance"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {translate(locale, "TV Shows")}
          </h1>
        </div>
        <Separator className="mt-5 bg-white/10" />
      </header>

      <Carousel
        title={translate(locale, "Trending TV Shows")}
        items={trending.map(tvToMedia)}
        priority
      />
      {sections.map(([title, category]) => (
        <LazyCarousel
          key={title}
          title={translate(locale, title)}
          src={`/api/browse?type=tv&category=${category}&lang=${locale}`}
        />
      ))}
    </div>
  );
}
