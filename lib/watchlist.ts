"use client";

import { getConsent } from "@/lib/consent";

const WATCHLIST_STORAGE_KEY = "binje:watchlist:v1";
const WATCHLIST_LIMIT = 100;
const WATCHLIST_EVENT = "binje:watchlist";

let lastRawWatchlist: string | null = null;
let lastWatchlistSnapshot: WatchlistItem[] = [];

export interface WatchlistItem {
  type: "movie" | "tv";
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  date: string;
  vote_average: number;
  addedAt: number;
}

export type WatchlistInput = Omit<WatchlistItem, "addedAt">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidWatchlistItem(value: unknown): value is WatchlistItem {
  if (!isRecord(value)) return false;

  const type = value.type;
  const id = value.id;
  const title = value.title;
  const addedAt = value.addedAt;

  if (type !== "movie" && type !== "tv") return false;
  if (typeof id !== "number" || !Number.isFinite(id) || id <= 0) return false;
  if (typeof title !== "string" || !title.trim()) return false;
  if (typeof addedAt !== "number" || !Number.isFinite(addedAt)) return false;

  return true;
}

function getWatchlistKey(item: Pick<WatchlistItem, "type" | "id">) {
  return `${item.type}:${item.id}`;
}

export function getWatchlist(): WatchlistItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (raw === lastRawWatchlist) return lastWatchlistSnapshot;
    lastRawWatchlist = raw;

    if (!raw) {
      lastWatchlistSnapshot = [];
      return lastWatchlistSnapshot;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      lastWatchlistSnapshot = [];
      return lastWatchlistSnapshot;
    }

    lastWatchlistSnapshot = parsed
      .filter(isValidWatchlistItem)
      .sort((a, b) => b.addedAt - a.addedAt)
      .slice(0, WATCHLIST_LIMIT);

    return lastWatchlistSnapshot;
  } catch {
    lastWatchlistSnapshot = [];
    return lastWatchlistSnapshot;
  }
}

function saveWatchlist(items: WatchlistItem[]) {
  if (typeof window === "undefined") return;
  if (getConsent() !== "accepted") return;
  window.localStorage.setItem(
    WATCHLIST_STORAGE_KEY,
    JSON.stringify(items.slice(0, WATCHLIST_LIMIT)),
  );
  window.dispatchEvent(new Event(WATCHLIST_EVENT));
}

export function isInWatchlist(item: Pick<WatchlistItem, "type" | "id">) {
  const key = getWatchlistKey(item);
  return getWatchlist().some((entry) => getWatchlistKey(entry) === key);
}

function addToWatchlist(input: WatchlistInput) {
  const nextItem: WatchlistItem = {
    ...input,
    addedAt: Date.now(),
  };
  const nextKey = getWatchlistKey(nextItem);
  const existing = getWatchlist().filter(
    (item) => getWatchlistKey(item) !== nextKey,
  );

  saveWatchlist([nextItem, ...existing]);
}

export function removeFromWatchlist(itemToRemove: Pick<WatchlistItem, "type" | "id">) {
  const keyToRemove = getWatchlistKey(itemToRemove);
  const nextItems = getWatchlist().filter(
    (item) => getWatchlistKey(item) !== keyToRemove,
  );

  saveWatchlist(nextItems);
}

export function toggleWatchlist(input: WatchlistInput) {
  if (isInWatchlist(input)) {
    removeFromWatchlist(input);
    return false;
  }

  addToWatchlist(input);
  return true;
}

export function getWatchlistHref(item: Pick<WatchlistItem, "type" | "id">) {
  return item.type === "tv" ? `/tv/${item.id}` : `/movie/${item.id}`;
}

export function subscribeToWatchlist(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key === WATCHLIST_STORAGE_KEY) onStoreChange();
  };

  window.addEventListener(WATCHLIST_EVENT, onStoreChange);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(WATCHLIST_EVENT, onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}
