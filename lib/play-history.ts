"use client";

import { getConsent } from "@/lib/consent";
import { createLocalArrayStore } from "@/lib/local-array-store";

const PLAY_HISTORY_STORAGE_KEY = "binje:play-history:v1";
const PLAY_HISTORY_LIMIT = 20;
const PLAY_HISTORY_EVENT = "binje:play-history";

export interface PlayHistoryItem {
  type: "movie" | "tv";
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  date: string;
  vote_average: number;
  watchedAt: number;
  season?: number;
  episode?: number;
  progress?: number;
  positionSeconds?: number;
  durationSeconds?: number;
}

export type PlayHistoryInput = Omit<PlayHistoryItem, "watchedAt">;
type PlayHistoryProgressInput = Pick<
  PlayHistoryItem,
  "type" | "id" | "season" | "episode"
> & {
  positionSeconds: number;
  durationSeconds: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidHistoryItem(value: unknown): value is PlayHistoryItem {
  if (!isRecord(value)) return false;

  const type = value.type;
  const id = value.id;
  const title = value.title;
  const watchedAt = value.watchedAt;

  if (type !== "movie" && type !== "tv") return false;
  if (typeof id !== "number" || !Number.isFinite(id) || id <= 0) return false;
  if (typeof title !== "string" || !title.trim()) return false;
  if (typeof watchedAt !== "number" || !Number.isFinite(watchedAt)) return false;

  return true;
}

function getHistoryKey(item: Pick<PlayHistoryItem, "type" | "id">) {
  return `${item.type}:${item.id}`;
}

function getEpisodeKey(
  item: Pick<PlayHistoryItem, "type" | "id" | "season" | "episode">,
) {
  if (item.type === "movie") return getHistoryKey(item);
  return `${getHistoryKey(item)}:${item.season ?? 1}:${item.episode ?? 1}`;
}

function clampProgress(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

const playHistoryStore = createLocalArrayStore<PlayHistoryItem>({
  key: PLAY_HISTORY_STORAGE_KEY,
  eventName: PLAY_HISTORY_EVENT,
  limit: PLAY_HISTORY_LIMIT,
  isValid: isValidHistoryItem,
  sort: (a, b) => b.watchedAt - a.watchedAt,
  canSave: () => getConsent() === "accepted",
});

export const getPlayHistory = playHistoryStore.get;
export const savePlayHistory = playHistoryStore.save;

export function upsertPlayHistory(input: PlayHistoryInput) {
  const now = Date.now();
  const existingItems = getPlayHistory();
  const existingProgress = existingItems.find(
    (item) => getEpisodeKey(item) === getEpisodeKey(input),
  );
  const nextItem: PlayHistoryItem = {
    progress: existingProgress?.progress,
    positionSeconds: existingProgress?.positionSeconds,
    durationSeconds: existingProgress?.durationSeconds,
    ...input,
    watchedAt: now,
  };
  const nextKey = getHistoryKey(nextItem);
  const existing = existingItems.filter(
    (item) => getHistoryKey(item) !== nextKey,
  );

  savePlayHistory([nextItem, ...existing]);
}

export function updatePlayHistoryProgress(input: PlayHistoryProgressInput) {
  const positionSeconds = input.positionSeconds;
  const durationSeconds = input.durationSeconds;

  if (
    !Number.isFinite(positionSeconds) ||
    !Number.isFinite(durationSeconds) ||
    positionSeconds < 0 ||
    durationSeconds <= 0
  ) {
    return;
  }

  const targetKey = getEpisodeKey(input);
  let didUpdate = false;
  const nextItems = getPlayHistory().map((item) => {
    if (getEpisodeKey(item) !== targetKey) return item;

    didUpdate = true;
    return {
      ...item,
      progress: clampProgress(positionSeconds / durationSeconds),
      positionSeconds,
      durationSeconds,
    };
  });

  if (didUpdate) savePlayHistory(nextItems);
}

export function removePlayHistoryItem(
  itemToRemove: Pick<PlayHistoryItem, "type" | "id">,
) {
  const keyToRemove = getHistoryKey(itemToRemove);
  const nextItems = getPlayHistory().filter(
    (item) => getHistoryKey(item) !== keyToRemove,
  );

  savePlayHistory(nextItems);
}

export function getPlayHistoryHref(item: PlayHistoryItem) {
  if (item.type === "movie") return `/watch/${item.id}`;

  const season = item.season ?? 1;
  const episode = item.episode ?? 1;
  return `/watch/tv/${item.id}?s=${season}&e=${episode}`;
}

export const subscribeToPlayHistory = playHistoryStore.subscribe;
