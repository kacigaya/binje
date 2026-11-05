import { useEffect } from 'react';
import { BackHandler, Platform, Text, type HWEvent } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { act, fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import type { VideoPlayer } from 'expo-video';
import { PlayerControls, formatTime } from '../PlayerControls';

let mockRemoteHandler: ((event: HWEvent) => void) | undefined;
jest.mock('react-native/Libraries/Components/TV/useTVEventHandler', () => ({ __esModule: true, default: (handler: (event: HWEvent) => void) => { mockRemoteHandler = handler; } }));
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));

jest.mock('@expo/vector-icons', () => ({ Feather: 'Feather', Ionicons: 'Ionicons', MaterialCommunityIcons: 'MaterialCommunityIcons' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('../../../providers/LocaleProvider', () => ({ useLocale: () => ({ locale: 'en', t: (key: string) => key }) }));

function makePlayer(state: { currentTime: number; duration: number; playing: boolean }) {
  return { ...state, play: jest.fn(), pause: jest.fn(), addListener: jest.fn(() => ({ remove: jest.fn() })) };
}
function renderControls(player: ReturnType<typeof makePlayer>, disabled = false) {
  return render(<PlayerControls player={player as unknown as VideoPlayer} crop={false} onCrop={jest.fn()} onFullscreen={jest.fn()} onPip={jest.fn()} disabled={disabled} />);
}

test('formats times like the web player', () => {
  expect(formatTime(5)).toBe('0:05');
  expect(formatTime(754)).toBe('12:34');
  expect(formatTime(3725)).toBe('1:02:05');
  expect(formatTime(Number.NaN)).toBe('0:00');
});

test('skips within the video bounds and toggles playback', async () => {
  const player = makePlayer({ currentTime: 4, duration: 100, playing: false });
  const user = userEvent.setup();
  renderControls(player);
  await user.press(screen.getByLabelText('back10'));
  expect(player.currentTime).toBe(0);
  player.currentTime = 95;
  await user.press(screen.getByLabelText('forward10'));
  expect(player.currentTime).toBe(100);
  await user.press(screen.getByLabelText('play'));
  expect(player.play).toHaveBeenCalled();
});

test('hides playback buttons while casting', () => {
  renderControls(makePlayer({ currentTime: 0, duration: 100, playing: false }), true);
  expect(screen.queryByLabelText('play')).toBeNull();
  expect(screen.getByLabelText('enterFullscreen')).toBeTruthy();
});

// The native event source is replaced; the controls and focus lifecycle stay mounted.
function useMockFocusEffect(effect: () => void | (() => void)) { useEffect(effect, [effect]); }

test('TV remote seeks with media keys, seeks with arrows only while hidden, wakes controls, auto-hides and lets the second back leave', () => {
  jest.useFakeTimers();
  const originalTV = Object.getOwnPropertyDescriptor(Platform, 'isTV');
  Object.defineProperty(Platform, 'isTV', { value: true, configurable: true });
  jest.mocked(useFocusEffect).mockImplementation(useMockFocusEffect);
  let back: Parameters<typeof BackHandler.addEventListener>[1] | undefined;
  const backEvent = { type: 'hardwareBackPress', timeStamp: 0 };
  const listener = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    back = handler;
    return { remove: jest.fn() };
  });
  const player = makePlayer({ currentTime: 4, duration: 100, playing: true });
  const view = renderControls(player);
  try {
    expect(screen.getByLabelText('pause').props.hasTVPreferredFocus).toBe(true);
    act(() => mockRemoteHandler?.({ eventType: 'left', eventKeyAction: 1 }));
    expect(player.currentTime).toBe(4);
    act(() => mockRemoteHandler?.({ eventType: 'right', eventKeyAction: 0 }));
    expect(player.currentTime).toBe(4);
    act(() => mockRemoteHandler?.({ eventType: 'fastForward', eventKeyAction: 1 }));
    expect(player.currentTime).toBe(14);
    act(() => mockRemoteHandler?.({ eventType: 'playPause', eventKeyAction: 1 }));
    expect(player.pause).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(3000));
    expect(screen.queryByLabelText('pause')).toBeNull();
    act(() => mockRemoteHandler?.({ eventType: 'left', eventKeyAction: 1 }));
    expect(player.currentTime).toBe(4);
    expect(screen.getByLabelText('pause')).toBeTruthy();
    act(() => { expect(back?.(backEvent)).toBe(true); });
    expect(screen.queryByLabelText('pause')).toBeNull();
    expect(back?.(backEvent)).toBe(false);
  } finally {
    view.unmount();
    listener.mockRestore();
    if (originalTV) Object.defineProperty(Platform, 'isTV', originalTV);
    jest.useRealTimers();
  }
});

test('TV puts every control in the bottom bar, seeks with left and right on the focused bar and closes a menu on back', () => {
  const originalTV = Object.getOwnPropertyDescriptor(Platform, 'isTV');
  Object.defineProperty(Platform, 'isTV', { value: true, configurable: true });
  jest.mocked(useFocusEffect).mockImplementation(useMockFocusEffect);
  let back: Parameters<typeof BackHandler.addEventListener>[1] | undefined;
  const listener = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    back = handler;
    return { remove: jest.fn() };
  });
  const player = makePlayer({ currentTime: 4, duration: 100, playing: false });
  const onCloseMenu = jest.fn();
  const view = render(<PlayerControls player={player as unknown as VideoPlayer} crop={false} onCrop={jest.fn()} onFullscreen={jest.fn()} onPip={jest.fn()} menuOpen onCloseMenu={onCloseMenu} episodeButtons={<Text>episode buttons</Text>} />);
  try {
    for (const label of ['play', 'back10', 'forward10', 'cropBars', 'pictureInPicture', 'seek']) expect(screen.getByLabelText(label)).toBeTruthy();
    expect(screen.queryByLabelText('enterFullscreen')).toBeNull();
    expect(screen.getByText('episode buttons')).toBeTruthy();
    // Arrows move focus between buttons until the bar has focus.
    act(() => mockRemoteHandler?.({ eventType: 'right', eventKeyAction: 1 }));
    expect(player.currentTime).toBe(4);
    fireEvent(screen.getByLabelText('seek'), 'focus');
    act(() => mockRemoteHandler?.({ eventType: 'right', eventKeyAction: 1 }));
    expect(player.currentTime).toBe(14);
    // A held key repeats key-down events and keeps scrubbing.
    act(() => mockRemoteHandler?.({ eventType: 'left', eventKeyAction: 0 }));
    expect(player.currentTime).toBe(4);
    fireEvent(screen.getByLabelText('seek'), 'blur');
    act(() => mockRemoteHandler?.({ eventType: 'right', eventKeyAction: 1 }));
    expect(player.currentTime).toBe(4);
    act(() => { expect(back?.({ type: 'hardwareBackPress', timeStamp: 0 })).toBe(true); });
    expect(onCloseMenu).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('play')).toBeTruthy();
  } finally {
    view.unmount();
    listener.mockRestore();
    if (originalTV) Object.defineProperty(Platform, 'isTV', originalTV);
  }
});

test('a drag on the progress bar keeps the controls up past the hide delay', () => {
  jest.useFakeTimers();
  const player = makePlayer({ currentTime: 4, duration: 100, playing: true });
  const view = renderControls(player);
  try {
    const seek = screen.getByLabelText('seek');
    const touch = { nativeEvent: { locationX: 0 } };
    fireEvent(seek, 'responderGrant', touch);
    act(() => jest.advanceTimersByTime(5000));
    expect(screen.getByLabelText('seek')).toBeTruthy();
    fireEvent(screen.getByLabelText('seek'), 'responderRelease', touch);
    expect(player.currentTime).toBe(0);
    // After release, the normal delay hides them again.
    act(() => jest.advanceTimersByTime(3000));
    expect(screen.queryByLabelText('seek')).toBeNull();
  } finally {
    view.unmount();
    jest.useRealTimers();
  }
});
