"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { PlayIcon } from "@/components/ui/play";
import { formatPlaybackTime } from "@/lib/format-time";
import { localizedHref } from "@/lib/i18n";
import {
  getPlayHistory,
  getPlayHistoryHref,
  getPlaybackProgress,
  subscribeToPlayHistory,
  type PlayHistoryItem,
} from "@/lib/play-history";
import { useAnimatedIcon } from "@/lib/use-animated-icon";
import { useTranslations } from "@/lib/use-locale";

const EMPTY_HISTORY: PlayHistoryItem[] = [];

/** Keep the initial label until browser history loads; then show the movie position or TV episode.
 * The client boundary also lets the play icon respond to the whole link. */
export default function WatchNowLink({
  href,
  label,
  className,
  media,
}: {
  href: string;
  label: string;
  className: string;
  media?: Pick<PlayHistoryItem, "type" | "id">;
}) {
  const { locale, t } = useTranslations();
  const [icon, feedback] = useAnimatedIcon();
  const history = useSyncExternalStore(
    subscribeToPlayHistory,
    getPlayHistory,
    () => EMPTY_HISTORY,
  );
  const entry = media
    ? history.find((item) => item.type === media.type && item.id === media.id)
    : undefined;

  let target = href;
  let text = label;
  if (entry?.type === "tv" && entry.season && entry.episode) {
    target = localizedHref(locale, getPlayHistoryHref(entry));
    text = `${t("Continue")} S${entry.season} · E${entry.episode}`;
  } else if (
    entry?.type === "movie" &&
    getPlaybackProgress(entry) !== null &&
    typeof entry.positionSeconds === "number"
  ) {
    text = `${t("Resume")} · ${formatPlaybackTime(entry.positionSeconds)}`;
  }

  return (
    <Link href={target} {...feedback} className={className}>
      <PlayIcon ref={icon} size={20} />
      {text}
    </Link>
  );
}
