import { getConsent } from './consent';
import { createJsonStore } from './jsonStore';

export const WATCHLIST_STORAGE_KEY = 'binje:mobile:watchlist:v1';
export const WATCHLIST_LIMIT = 100;
export interface WatchlistItem { type: 'movie' | 'tv'; id: number; title: string; poster_path: string | null; backdrop_path: string | null; date: string; vote_average: number; addedAt: number }
export type WatchlistInput = Omit<WatchlistItem, 'addedAt'>;

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
export function isValidWatchlistItem(v: unknown): v is WatchlistItem {
  if (!record(v)) return false;
  return (v.type === 'movie' || v.type === 'tv') && typeof v.id === 'number' && Number.isFinite(v.id) && v.id > 0 && typeof v.title === 'string' && !!v.title.trim() && (typeof v.poster_path === 'string' || v.poster_path === null) && (typeof v.backdrop_path === 'string' || v.backdrop_path === null) && typeof v.date === 'string' && typeof v.vote_average === 'number' && Number.isFinite(v.vote_average) && typeof v.addedAt === 'number' && Number.isFinite(v.addedAt);
}
const validList = (v: unknown): v is WatchlistItem[] => Array.isArray(v) && v.every(isValidWatchlistItem);
const store = createJsonStore(WATCHLIST_STORAGE_KEY, validList, []);
const key = (v: Pick<WatchlistItem, 'type' | 'id'>) => `${v.type}:${v.id}`;

export async function getWatchlist() { return (await store.get()).sort((a, b) => b.addedAt - a.addedAt).slice(0, WATCHLIST_LIMIT); }
export async function saveWatchlist(items: WatchlistItem[]) {
  if (await getConsent() !== 'accepted') return false;
  const seen = new Set<string>();
  const clean = items.filter(isValidWatchlistItem).sort((a,b) => b.addedAt-a.addedAt).filter(item => !seen.has(key(item)) && !!seen.add(key(item))).slice(0, WATCHLIST_LIMIT);
  await store.set(clean); return true;
}
export async function isInWatchlist(item: Pick<WatchlistItem, 'type'|'id'>) { return (await getWatchlist()).some(v => key(v) === key(item)); }
export async function addToWatchlist(input: WatchlistInput) { const items = (await getWatchlist()).filter(v => key(v) !== key(input)); return saveWatchlist([{...input, addedAt: Date.now()}, ...items]); }
export async function removeFromWatchlist(item: Pick<WatchlistItem,'type'|'id'>) { return saveWatchlist((await getWatchlist()).filter(v => key(v) !== key(item))); }
export async function toggleWatchlist(input: WatchlistInput) { if (await isInWatchlist(input)) { await removeFromWatchlist(input); return false; } await addToWatchlist(input); return true; }
export const subscribeToWatchlist = store.subscribe;
