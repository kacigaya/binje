import { render, screen, userEvent } from '@testing-library/react-native';
import type { VideoPlayer } from 'expo-video';
import { PlayerControls, formatTime } from '../PlayerControls';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
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
