import { beforeEach, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJsonStore } from './jsonStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(() => AsyncStorage.clear());

test('returns fallback for missing, malformed, and invalid data', async () => {
  const store = createJsonStore('key', (v): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string'), []);
  expect(await store.get()).toEqual([]);
  await AsyncStorage.setItem('key', '{bad');
  expect(await store.get()).toEqual([]);
  await AsyncStorage.setItem('key', '[1]');
  expect(await store.get()).toEqual([]);
});

test('persists and notifies subscribers', async () => {
  const store = createJsonStore('key', (v): v is string[] => Array.isArray(v), []);
  const listener = jest.fn();
  const unsubscribe = store.subscribe(listener);
  await store.set(['ok']);
  expect(await store.get()).toEqual(['ok']);
  expect(listener).toHaveBeenCalledTimes(1);
  unsubscribe();
});
