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

/**
 * The primary "watch" call to action. It is a client component so the play
 * glyph can react to the link, which the detail pages render from the server.
 *
 * Given `media`, it turns into a resume control once local play history has
 * an entry for that title: movies name the position, shows name the episode.
 * The server render and first paint keep the plain label, since history only
 * exists in the browser.
 */
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
