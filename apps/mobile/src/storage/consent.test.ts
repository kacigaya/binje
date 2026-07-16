import { beforeEach, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getConsent, setConsent } from './consent';
jest.mock('@react-native-async-storage/async-storage',()=>require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
beforeEach(()=>AsyncStorage.clear());
test('only accepts valid consent values',async()=>{expect(await getConsent()).toBeNull();await AsyncStorage.setItem('binje:mobile:consent:v1','bad');expect(await getConsent()).toBeNull();await setConsent('accepted');expect(await getConsent()).toBe('accepted');});
