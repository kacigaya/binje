import { getConsent } from './consent';
import { createJsonStore } from './jsonStore';

export const PLAY_HISTORY_STORAGE_KEY = 'binje:mobile:play-history:v1';
export const PLAY_HISTORY_LIMIT = 20;
export interface PlayHistoryItem { type:'movie'|'tv'; id:number; title:string; poster_path:string|null; backdrop_path:string|null; date:string; vote_average:number; watchedAt:number; season?:number; episode?:number; progress?:number; positionSeconds?:number; durationSeconds?:number }
export type PlayHistoryInput = Omit<PlayHistoryItem,'watchedAt'>;
export type PlayHistoryProgressInput = Pick<PlayHistoryItem,'type'|'id'|'season'|'episode'> & {positionSeconds:number;durationSeconds:number};
const rec=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null;
const optionalFinite=(v:unknown)=>v===undefined||(typeof v==='number'&&Number.isFinite(v));
export function isValidPlayHistoryItem(v:unknown):v is PlayHistoryItem {
 if(!rec(v)) return false;
 if(!((v.type==='movie'||v.type==='tv')&&typeof v.id==='number'&&Number.isFinite(v.id)&&v.id>0&&typeof v.title==='string'&&!!v.title.trim()&&(typeof v.poster_path==='string'||v.poster_path===null)&&(typeof v.backdrop_path==='string'||v.backdrop_path===null)&&typeof v.date==='string'&&typeof v.vote_average==='number'&&Number.isFinite(v.vote_average)&&typeof v.watchedAt==='number'&&Number.isFinite(v.watchedAt))) return false;
 if(!optionalFinite(v.season)||!optionalFinite(v.episode)||!optionalFinite(v.progress)||!optionalFinite(v.positionSeconds)||!optionalFinite(v.durationSeconds)) return false;
 if(v.type==='tv'&&((v.season!==undefined&&(typeof v.season !== 'number'||!Number.isInteger(v.season)||v.season<0))||(v.episode!==undefined&&(typeof v.episode !== 'number'||!Number.isInteger(v.episode)||v.episode<1)))) return false;
 return v.progress===undefined||(typeof v.progress === 'number'&&v.progress>=0&&v.progress<=1);
}
const valid=(v:unknown):v is PlayHistoryItem[]=>Array.isArray(v)&&v.every(isValidPlayHistoryItem);
const store=createJsonStore(PLAY_HISTORY_STORAGE_KEY,valid,[]);
const mediaKey=(v:Pick<PlayHistoryItem,'type'|'id'>)=>`${v.type}:${v.id}`;
const episodeKey=(v:Pick<PlayHistoryItem,'type'|'id'|'season'|'episode'>)=>v.type==='movie'?mediaKey(v):`${mediaKey(v)}:${v.season??1}:${v.episode??1}`;
export async function getPlayHistory(){return (await store.get()).sort((a,b)=>b.watchedAt-a.watchedAt).slice(0,PLAY_HISTORY_LIMIT);}
export async function savePlayHistory(items:PlayHistoryItem[]){if(await getConsent()!=='accepted')return false;const seen=new Set<string>();const clean=items.filter(isValidPlayHistoryItem).sort((a,b)=>b.watchedAt-a.watchedAt).filter(v=>{const k=mediaKey(v);if(seen.has(k))return false;seen.add(k);return true;}).slice(0,PLAY_HISTORY_LIMIT);await store.set(clean);return true;}
export async function upsertPlayHistory(input:PlayHistoryInput){const items=await getPlayHistory();const old=items.find(v=>episodeKey(v)===episodeKey(input));const next:PlayHistoryItem={progress:old?.progress,positionSeconds:old?.positionSeconds,durationSeconds:old?.durationSeconds,...input,watchedAt:Date.now()};return savePlayHistory([next,...items.filter(v=>mediaKey(v)!==mediaKey(next))]);}
export async function updatePlayHistoryProgress(input:PlayHistoryProgressInput){if(!Number.isFinite(input.positionSeconds)||!Number.isFinite(input.durationSeconds)||input.positionSeconds<0||input.durationSeconds<=0)return false;let changed=false;const items=(await getPlayHistory()).map(v=>{if(episodeKey(v)!==episodeKey(input))return v;changed=true;return {...v,progress:Math.min(1,Math.max(0,input.positionSeconds/input.durationSeconds)),positionSeconds:input.positionSeconds,durationSeconds:input.durationSeconds};});return changed?savePlayHistory(items):false;}
export async function removePlayHistoryItem(item:Pick<PlayHistoryItem,'type'|'id'>){return savePlayHistory((await getPlayHistory()).filter(v=>mediaKey(v)!==mediaKey(item)));}
export async function clearPlayHistory(){if(await getConsent()!=='accepted')return false;await store.set([]);return true;}
export const subscribeToPlayHistory=store.subscribe;
