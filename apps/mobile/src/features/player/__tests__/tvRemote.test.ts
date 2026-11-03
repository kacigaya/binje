import { Platform } from 'react-native';
import { seekPosition, tvPlaybackAction } from '../tvRemote';

const originalTV = Object.getOwnPropertyDescriptor(Platform, 'isTV');
beforeEach(() => { Object.defineProperty(Platform, 'isTV', { value: false, writable: true, configurable: true }); });
afterEach(() => { if (originalTV) Object.defineProperty(Platform, 'isTV', originalTV); });

test.each([
  ['left', 'rewind'], ['right', 'forward'], ['rewind', 'rewind'],
  ['fastForward', 'forward'], ['playPause', 'toggle'], ['play', 'play'], ['pause', 'pause'],
])('maps TV key %s to %s once on key up', (key, action) => {
  Platform.isTV = true;
  expect(tvPlaybackAction(key, 1)).toBe(action);
  expect(tvPlaybackAction(key, 0)).toBeNull();
  Platform.isTV = false;
  expect(tvPlaybackAction(key, 1)).toBeNull();
});

test('arrows move focus instead of seeking while controls are visible', () => {
  Platform.isTV = true;
  expect(tvPlaybackAction('left', 1, true)).toBeNull();
  expect(tvPlaybackAction('right', 1, true)).toBeNull();
  expect(tvPlaybackAction('rewind', 1, true)).toBe('rewind');
  expect(tvPlaybackAction('fastForward', 1, true)).toBe('forward');
});

test('leaves select to Pressable and back to navigation', () => {
  Platform.isTV = true;
  expect(tvPlaybackAction('select')).toBeNull();
  expect(tvPlaybackAction('menu')).toBeNull();
});

test('clamps seeking at both ends and supports an unknown duration', () => {
  expect(seekPosition(4, 100, -10)).toBe(0);
  expect(seekPosition(95, 100, 10)).toBe(100);
  expect(seekPosition(95, 0, 10)).toBe(105);
});
