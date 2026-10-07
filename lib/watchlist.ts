"use client";

import { toast } from "sonner";
import { hasStorageConsent } from "@/lib/consent";
import type { TranslationKey } from "@/lib/i18n";
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
  canSave: hasStorageConsent,
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

/**
 * Toggle from a control and confirm it. Without storage consent nothing is
 * written, so say so instead of confirming a save that did not happen.
 */
export function toggleWatchlistWithFeedback(
  input: WatchlistInput,
  added: boolean,
  t: (text: TranslationKey) => string,
) {
  if (!hasStorageConsent()) {
    toast.error(t("Allow local storage to save titles."));
    return;
  }
  toggleWatchlist(input);
  toast.success(t(added ? "Removed from watchlist" : "Added to watchlist"), {
    description: input.title,
  });
}

export function getWatchlistHref(item: Pick<WatchlistItem, "type" | "id">) {
  return item.type === "tv" ? `/tv/${item.id}` : `/movie/${item.id}`;
}

export const subscribeToWatchlist = watchlistStore.subscribe;
