import { beforeEach, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { en, fr, localeFromTags, resolveLocale, translate } from '.';
import { setLocalePreference } from '../storage/preferences';
jest.mock('@react-native-async-storage/async-storage',()=>require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
beforeEach(()=>AsyncStorage.clear());
test('detects supported tags and falls back to English',()=>{expect(localeFromTags(['de-DE','fr-FR'])).toBe('fr');expect(localeFromTags(['de-DE'])).toBe('en');});
test('persisted locale overrides device locale',async()=>{await setLocalePreference('fr');expect(await resolveLocale([{languageTag:'en-US'}] as never)).toBe('fr');});
test('translations have key parity and translate',()=>{expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());expect(translate('fr','movies')).toBe('Films');expect(translate('en','movies')).toBe('Movies');});
