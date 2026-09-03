"use client";

import { useState, useEffect, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Play, Clock } from "lucide-react";
import { ChevronLeftIcon } from "@/components/ui/chevron-left";
import { ChevronRightIcon } from "@/components/ui/chevron-right";
import { useAnimatedIcon } from "@/lib/use-animated-icon";
import { Select } from "@/components/ui/select";
import Player from "@/components/Player";
import ScrollArrows from "@/components/ScrollArrows";
import { Button } from "@/components/ui/button";
import { useHorizontalScroll } from "@/lib/use-horizontal-scroll";
import { stillUrl } from "@/lib/tmdb";
import type { Episode } from "@/types/tmdb";
import { localizedHref } from "@/lib/i18n";
import { useTranslations } from "@/lib/use-locale";

interface SeasonInfo {
  season_number: number;
  name: string;
  episode_count: number;
}

export default function TVPlayer({
  showId,
  title,
  year,
  imdbId,
  season: initialSeason,
  episode: initialEpisode,
  seasons,
  initialEpisodes,
}: {
  showId: number;
  title: string;
  year: string;
  imdbId: string | null;
  season: number;
  episode: number;
  seasons: SeasonInfo[];
  initialEpisodes: Episode[];
}) {
  const { locale, t } = useTranslations();
  const router = useRouter();
  const [season, setSeason] = useState(initialSeason);
  const [episode, setEpisode] = useState(initialEpisode);
  const [episodes, setEpisodes] = useState<Episode[]>(initialEpisodes);
  const [episodesSeason, setEpisodesSeason] = useState(initialSeason);

  const currentSeason = seasons.find((s) => s.season_number === season);
  const maxEpisodes = currentSeason?.episode_count ?? 1;
  const loading = episodesSeason !== season;

  useEffect(() => {
    if (episodesSeason === season) return;

    let cancelled = false;
    fetch(`/api/episodes?showId=${showId}&season=${season}&lang=${locale}`)
      .then((res) => (res.ok ? res.json() : { episodes: [] }))
      .then((data) => {
        if (cancelled) return;
        setEpisodes(data.episodes ?? []);
        setEpisodesSeason(season);
      })
      .catch(() => {
        if (cancelled) return;
        setEpisodes([]);
        setEpisodesSeason(season);
      });

    return () => {
      cancelled = true;
    };
  }, [episodesSeason, locale, season, showId]);

  const {
    scrollRef,
    canScrollLeft,
    canScrollRight,
    scroll: scrollEpisodes,
  } = useHorizontalScroll(`${episodesSeason}:${episodes.length}:${loading}`);

  function episodeHref(s: number, e: number) {
    return localizedHref(locale, `/watch/tv/${showId}?s=${s}&e=${e}`);
  }

  function navigate(s: number, e: number) {
    setSeason(s);
    setEpisode(e);
    router.replace(episodeHref(s, e), { scroll: false });
  }

  /**
   * Swapping episodes only changes the player source, so it is handled here
   * rather than by following the link. Modified clicks fall through untouched
   * so an episode can still be opened in its own tab.
   */
  function selectEpisode(
    event: MouseEvent<HTMLAnchorElement>,
    episodeNumber: number,
  ) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(season, episodeNumber);
  }

  function prevEpisode() {
    if (episode > 1) {
      navigate(season, episode - 1);
    } else {
      const prevSeason = seasons.find((s) => s.season_number === season - 1);
      if (prevSeason) {
        navigate(prevSeason.season_number, prevSeason.episode_count);
      }
    }
  }

  function nextEpisode() {
    if (episode < maxEpisodes) {
      navigate(season, episode + 1);
    } else {
      const nextSeason = seasons.find((s) => s.season_number === season + 1);
      if (nextSeason) {
        navigate(nextSeason.season_number, 1);
      }
    }
  }

  const hasPrev =
    episode > 1 || seasons.some((s) => s.season_number === season - 1);
  const hasNext =
    episode < maxEpisodes ||
    seasons.some((s) => s.season_number === season + 1);

  const [prevIcon, prevFeedback] = useAnimatedIcon();
  const [nextIcon, nextFeedback] = useAnimatedIcon();

  return (
    <div className="space-y-4">
      <Player
        tmdbId={showId}
        title={title}
        year={year}
        imdbId={imdbId}
        type="tv"
        season={season}
        episode={episode}
      />

      <div className="flex flex-col gap-4 px-4 sm:flex-row sm:items-center sm:px-0">
        <div className="flex items-center justify-between gap-3 sm:justify-start">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("Season")}
          </span>
          <Select
            ariaLabel={t("Season")}
            value={season}
            onValueChange={(value) => navigate(value, 1)}
            items={seasons.map((s) => ({
              value: s.season_number,
              label: s.name,
            }))}
            className="h-10 rounded-full border border-white/15 bg-white/5 px-4 text-sm font-medium text-foreground transition-colors hover:bg-white/10 focus-visible:border-accent-red/50 focus-visible:ring-accent-red/30"
          />
        </div>

        <div className="flex min-w-0 items-center sm:border-l sm:border-white/10 sm:pl-4">
          <p className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t("Now playing")}
            </span>
            <span
              className="block truncate text-sm font-semibold text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {currentSeason?.name ?? `${t("Season")} ${season}`}, {t("Episode")} {episode}
            </span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:ml-auto sm:flex">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={prevEpisode}
            {...prevFeedback}
            disabled={!hasPrev}
            className="h-10 rounded-full px-4 cursor-pointer"
          >
            <ChevronLeftIcon ref={prevIcon} size={16} />
            {t("Previous")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={nextEpisode}
            {...nextFeedback}
            disabled={!hasNext}
            className="h-10 rounded-full px-4 cursor-pointer"
          >
            {t("Next")}
            <ChevronRightIcon ref={nextIcon} size={16} />
          </Button>
        </div>
      </div>

      <div className="px-4 sm:px-0">
        <h2
          className="text-lg font-semibold mb-3"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {t("Episodes")}
        </h2>

        {loading ? (
          <div className="flex gap-4 overflow-x-auto scrollbar-hide pt-1 pl-1 pb-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="w-72 sm:w-80 shrink-0 aspect-video rounded-2xl bg-white/5 animate-pulse motion-reduce:animate-none"
              />
            ))}
          </div>
        ) : episodes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("No episode previews available.")}
          </p>
        ) : (
          <div className="group/scroll relative">
            <ScrollArrows
              canScrollLeft={canScrollLeft}
              canScrollRight={canScrollRight}
              scroll={scrollEpisodes}
            />

            <div
              ref={scrollRef}
              tabIndex={0}
              role="group"
              aria-label={t("Episodes")}
              className="flex gap-4 overflow-x-auto scrollbar-hide pt-1 pl-1 pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/50"
            >
              {episodes.map((ep) => {
              const still = stillUrl(ep.still_path, "w300");
              const isActive = ep.episode_number === episode;
              return (
                <Link
                  key={ep.id}
                  href={episodeHref(season, ep.episode_number)}
                  onClick={(event) => selectEpisode(event, ep.episode_number)}
                  aria-current={isActive ? "true" : undefined}
                  className={`group relative w-72 sm:w-80 shrink-0 text-left aspect-video rounded-2xl overflow-hidden ring-1 transition-[box-shadow] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red ${
                    isActive
                      ? "ring-2 ring-white"
                      : "ring-white/10 hover:ring-white/30"
                  }`}
                >
                  {still ? (
                    <Image
                      src={still}
                      alt={ep.name}
                      fill
                      loading="lazy"
                      className="object-cover transition-transform duration-200 group-hover:scale-105"
                      sizes="320px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-card text-muted-foreground text-xs">
                      {t("No preview")}
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent transition-opacity group-hover:opacity-0" />

                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="size-9 text-white fill-white" />
                  </div>

                  <div className="absolute inset-x-0 bottom-0 p-3.5 space-y-1 transition-opacity group-hover:opacity-0">
                    <p className="text-sm font-semibold leading-snug text-white line-clamp-2">
                      {isActive && (
                        <span className="mr-1.5 inline-block translate-y-[-1px] rounded bg-accent-red px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider align-middle">
                          {t("Watching")}
                        </span>
                      )}
                      {ep.episode_number}. {ep.name}
                    </p>
                    {ep.runtime ? (
                      <span className="flex items-center gap-1 text-[11px] text-white/60">
                        <Clock className="size-3" />
                        {ep.runtime}m
                      </span>
                    ) : null}
                    {ep.overview ? (
                      <p className="text-[11px] leading-snug text-white/50 line-clamp-2">
                        {ep.overview}
                      </p>
                    ) : null}
                  </div>

                  {isActive && (
                    <span className="absolute inset-x-0 bottom-0 h-1 bg-accent-red transition-opacity group-hover:opacity-0" />
                  )}
                </Link>
              );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
