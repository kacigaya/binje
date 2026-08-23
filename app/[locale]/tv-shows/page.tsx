import type { Metadata } from "next";
import { locale as getRootLocale } from "next/root-params";
import { Suspense } from "react";
import { Tv } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import Carousel from "@/components/Carousel";
import CarouselSkeleton from "@/components/CarouselSkeleton";
import {
  getAiringTodayTV,
  getOnTheAirTV,
  getPopularTV,
  getTopRatedTV,
  getTrendingTV,
  getTVByGenre,
} from "@/lib/cached-tmdb";
import { tvToMedia } from "@/lib/tmdb";
import { isLocale, translate, type Locale, type TranslationKey } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: translate(locale, "TV Shows") };
}

const SECTIONS = [
  ["Trending TV Shows", getTrendingTV, true],
  ["Popular TV Shows", getPopularTV],
  ["Top Rated TV Shows", getTopRatedTV],
  ["Airing Today", getAiringTodayTV],
  ["On The Air", getOnTheAirTV],
  ["Action & Adventure", (locale: Locale) => getTVByGenre(10759, locale)],
  ["Comedy", (locale: Locale) => getTVByGenre(35, locale)],
  ["Drama", (locale: Locale) => getTVByGenre(18, locale)],
  ["Sci-Fi & Fantasy", (locale: Locale) => getTVByGenre(10765, locale)],
  ["Documentary", (locale: Locale) => getTVByGenre(99, locale)],
] as const;

async function TVRail({
  locale,
  title,
  load,
  priority = false,
}: {
  locale: Locale;
  title: TranslationKey;
  load: (locale: Locale) => ReturnType<typeof getTrendingTV>;
  priority?: boolean;
}) {
  const shows = await load(locale).catch(() => []);
  return (
    <Carousel
      title={translate(locale, title)}
      items={shows.map(tvToMedia)}
      priority={priority}
    />
  );
}

export default async function TVShowsPage() {
  const rootLocale = await getRootLocale();
  const locale = isLocale(rootLocale) ? rootLocale : "en";

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

      {SECTIONS.map(([title, load, priority]) => (
        <Suspense key={title} fallback={<CarouselSkeleton />}>
          <TVRail
            locale={locale}
            title={title}
            load={load}
            priority={priority}
          />
        </Suspense>
      ))}
    </div>
  );
}
