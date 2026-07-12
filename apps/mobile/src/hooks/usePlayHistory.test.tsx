import { act, renderHook, waitFor } from '@testing-library/react-native';
import { beforeEach, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePlayHistory } from './usePlayHistory';
import { setConsent } from '../storage/consent';
jest.mock('@react-native-async-storage/async-storage',()=>require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
beforeEach(()=>AsyncStorage.clear());
test('reacts to repository writes and progress updates',async()=>{await setConsent('accepted');const {result}=renderHook(()=>usePlayHistory());await waitFor(()=>expect(result.current.isLoading).toBe(false));await act(async()=>{await result.current.upsert({type:'movie',id:2,title:'Two',poster_path:null,backdrop_path:null,date:'',vote_average:7});});await waitFor(()=>expect(result.current.items).toHaveLength(1));await act(async()=>{await result.current.updateProgress({type:'movie',id:2,positionSeconds:25,durationSeconds:100});});await waitFor(()=>expect(result.current.items[0].progress).toBe(.25));});
