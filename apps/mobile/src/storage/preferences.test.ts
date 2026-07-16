import { beforeEach, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPreferences, setLocalePreference } from './preferences';
jest.mock('@react-native-async-storage/async-storage',()=>require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
beforeEach(()=>AsyncStorage.clear());
test('persists locale and rejects corrupt preferences',async()=>{await setLocalePreference('fr');expect(await getPreferences()).toEqual({locale:'fr'});await AsyncStorage.setItem('binje:mobile:preferences:v1','{"locale":"es"}');expect(await getPreferences()).toEqual({});});
