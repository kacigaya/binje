import { beforeEach, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setConsent } from './consent';
import { addToWatchlist, getWatchlist, saveWatchlist, WATCHLIST_LIMIT, type WatchlistItem } from './watchlist';
jest.mock('@react-native-async-storage/async-storage',()=>require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
const item=(id:number, addedAt=id):WatchlistItem=>({type:'movie',id,title:`Movie ${id}`,poster_path:null,backdrop_path:null,date:'2026',vote_average:7,addedAt});
beforeEach(()=>AsyncStorage.clear());
test('requires consent, deduplicates, sorts, and limits',async()=>{await addToWatchlist({...item(1),addedAt:undefined} as never);expect(await getWatchlist()).toEqual([]);await setConsent('accepted');await saveWatchlist([...Array(105)].map((_,i)=>item((i%101)+1,i)));const values=await getWatchlist();expect(values).toHaveLength(WATCHLIST_LIMIT);expect(new Set(values.map(v=>v.id)).size).toBe(100);expect(values[0].addedAt).toBeGreaterThan(values[1].addedAt);});
test('rejects corrupt stored records',async()=>{await AsyncStorage.setItem('binje:mobile:watchlist:v1',JSON.stringify([item(1),{id:'bad'}]));expect(await getWatchlist()).toEqual([]);});
