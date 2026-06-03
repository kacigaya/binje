"use client";

import { getConsent } from "@/lib/consent";

export const PLAY_HISTORY_STORAGE_KEY = "binje:play-history:v1";
export const PLAY_HISTORY_LIMIT = 20;
export const PLAY_HISTORY_EVENT = "binje:play-history";

let lastRawHistory: string | null = null;
let lastHistorySnapshot: PlayHistoryItem[] = [];

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
}

export type PlayHistoryInput = Omit<PlayHistoryItem, "watchedAt">;

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

export function getPlayHistory(): PlayHistoryItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(PLAY_HISTORY_STORAGE_KEY);
    if (raw === lastRawHistory) return lastHistorySnapshot;
    lastRawHistory = raw;

    if (!raw) {
      lastHistorySnapshot = [];
      return lastHistorySnapshot;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      lastHistorySnapshot = [];
      return lastHistorySnapshot;
    }

    lastHistorySnapshot = parsed
      .filter(isValidHistoryItem)
      .sort((a, b) => b.watchedAt - a.watchedAt)
      .slice(0, PLAY_HISTORY_LIMIT);

    return lastHistorySnapshot;
  } catch {
    lastHistorySnapshot = [];
    return lastHistorySnapshot;
  }
}

export function savePlayHistory(items: PlayHistoryItem[]) {
  if (typeof window === "undefined") return;
  if (getConsent() !== "accepted") return;
  window.localStorage.setItem(
    PLAY_HISTORY_STORAGE_KEY,
    JSON.stringify(items.slice(0, PLAY_HISTORY_LIMIT)),
  );
  window.dispatchEvent(new Event(PLAY_HISTORY_EVENT));
}

export function upsertPlayHistory(input: PlayHistoryInput) {
  const now = Date.now();
  const nextItem: PlayHistoryItem = {
    ...input,
    watchedAt: now,
  };
  const nextKey = getHistoryKey(nextItem);
  const existing = getPlayHistory().filter(
    (item) => getHistoryKey(item) !== nextKey,
  );

  savePlayHistory([nextItem, ...existing]);
}

export function removePlayHistoryItem(itemToRemove: Pick<PlayHistoryItem, "type" | "id">) {
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

export function subscribeToPlayHistory(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key === PLAY_HISTORY_STORAGE_KEY) onStoreChange();
  };

  window.addEventListener(PLAY_HISTORY_EVENT, onStoreChange);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(PLAY_HISTORY_EVENT, onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}
