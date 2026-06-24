"use client";

import { getConsent } from "@/lib/consent";
import { createLocalArrayStore } from "@/lib/local-array-store";

const WATCHLIST_STORAGE_KEY = "binje:watchlist:v1";
const WATCHLIST_LIMIT = 100;
const WATCHLIST_EVENT = "binje:watchlist";

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

const watchlistStore = createLocalArrayStore<WatchlistItem>({
  key: WATCHLIST_STORAGE_KEY,
  eventName: WATCHLIST_EVENT,
  limit: WATCHLIST_LIMIT,
  isValid: isValidWatchlistItem,
  sort: (a, b) => b.addedAt - a.addedAt,
  canSave: () => getConsent() === "accepted",
});

export const getWatchlist = watchlistStore.get;
export const saveWatchlist = watchlistStore.save;

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

export function removeFromWatchlist(
  itemToRemove: Pick<WatchlistItem, "type" | "id">,
) {
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

export const subscribeToWatchlist = watchlistStore.subscribe;
