import { act, renderHook, waitFor } from '@testing-library/react-native';
import { beforeEach, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWatchlist } from './useWatchlist';
import { setConsent } from '../storage/consent';
jest.mock('@react-native-async-storage/async-storage',()=>require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
beforeEach(()=>AsyncStorage.clear());
test('reacts to repository writes',async()=>{await setConsent('accepted');const {result}=renderHook(()=>useWatchlist());await waitFor(()=>expect(result.current.isLoading).toBe(false));await act(async()=>{await result.current.toggle({type:'movie',id:1,title:'One',poster_path:null,backdrop_path:null,date:'',vote_average:8});});await waitFor(()=>expect(result.current.items).toHaveLength(1));expect(result.current.contains({type:'movie',id:1})).toBe(true);});
