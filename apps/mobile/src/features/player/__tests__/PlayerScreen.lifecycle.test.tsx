import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { PlayerScreen } from '../PlayerScreen';
import { resolveStream } from '../resolveStream';

const mockEvents: string[] = [];
const mockBack = jest.fn();
const mockTranslate = (key: string) => key;
const mockMedia = {
  title: 'Example', date: '2025-01-01', rating: 7,
  stream: { originalTitle: 'Example', year: '2025' },
  seasons: [{ id: 1, seasonNumber: 1, episodeCount: 3, name: 'Season 1' }],
};
let mockReleased = false;
function mockAssertLive() {
  if (mockReleased) throw new Error('Cannot use shared object that was already released');
}
const mockPlayer = {
  currentTime: 0,
  duration: 100,
  availableVideoTracks: [],
  release: jest.fn(() => { mockEvents.push('release'); mockReleased = true; }),
  pause: jest.fn(() => { mockAssertLive(); mockEvents.push('pause'); }),
  play: jest.fn(() => { mockAssertLive(); mockEvents.push('play'); }),
  replaceAsync: jest.fn(async () => { mockAssertLive(); }),
  addListener: jest.fn(() => { mockAssertLive(); return { remove: jest.fn() }; }),
};
jest.mock('expo-video', () => ({
  VideoView: () => null,
  useVideoPlayer: () => {
    // Use Expo's cleanup ordering. Its native object releases before the screen's effects.
    const { useReleasingSharedObject } = jest.requireActual('../../../../../../node_modules/expo-modules-core/src/hooks/useReleasingSharedObject.ts');
    return useReleasingSharedObject(() => mockPlayer, []);
  },
}));
jest.mock('@tanstack/react-query', () => ({ useQuery: ({ queryKey }: { queryKey: string[] }) => ({ data: queryKey[0] === 'season' ? { episodes: [] } : mockMedia, isLoading: false, isError: false }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));
jest.mock('expo-router', () => ({ router: { canGoBack: () => true, back: () => mockBack(), push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0 }) }));
jest.mock('../../../api/media', () => ({ getMediaDetails: jest.fn(), getSeason: jest.fn() }));
jest.mock('../../../providers/LocaleProvider', () => ({ useLocale: () => ({ locale: 'en', t: mockTranslate }) }));
jest.mock('../../../storage/playHistory', () => ({ getResumePosition: jest.fn().mockResolvedValue(12), upsertPlayHistory: jest.fn().mockResolvedValue(undefined), updatePlayHistoryProgress: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../PlayerControls', () => ({ PlayerControls: () => null }));
jest.mock('../CastControls', () => () => null);
jest.mock('../resolveStream', () => ({
  fetchAvailableSources: jest.fn().mockResolvedValue(['vidcore']),
  resolveStream: jest.fn(),
  proxiedHlsUrl: (url: string) => url,
  selectPlaybackSource: () => 'vidcore',
}));

beforeEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
  mockEvents.length = 0;
  mockReleased = false;
  mockPlayer.currentTime = 0;
  jest.mocked(resolveStream).mockResolvedValue({ url: 'https://example.com/video.m3u8' });
});

test('Back during playback does not call the released native player', async () => {
  const view = render(<PlayerScreen type="movie" id={1} />);
  await waitFor(() => expect(mockPlayer.play).toHaveBeenCalled());
  mockBack.mockImplementation(() => view.unmount());
  expect(() => fireEvent.press(view.getByLabelText('back'))).not.toThrow();
  expect(mockPlayer.release).toHaveBeenCalledTimes(1);
  expect(mockEvents.at(-1)).toBe('release');
});

test('Back during source resolution cancels loading', async () => {
  let finish: (value: { url: string }) => void = () => {};
  jest.mocked(resolveStream).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const view = render(<PlayerScreen type="movie" id={1} />);
  await waitFor(() => expect(resolveStream).toHaveBeenCalled());
  expect(() => view.unmount()).not.toThrow();
  await act(async () => { finish({ url: 'https://example.com/video.m3u8' }); });
  expect(mockPlayer.replaceAsync).not.toHaveBeenCalled();
  expect(mockPlayer.play).not.toHaveBeenCalled();
});

test('Back during native replacement prevents late playback and seeking', async () => {
  let finish = () => {};
  mockPlayer.replaceAsync.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  const view = render(<PlayerScreen type="movie" id={1} />);
  await waitFor(() => expect(mockPlayer.replaceAsync).toHaveBeenCalled());
  expect(() => view.unmount()).not.toThrow();
  await act(async () => { finish(); });
  expect(mockPlayer.currentTime).toBe(0);
  expect(mockPlayer.play).not.toHaveBeenCalled();
});

test('changing episodes still pauses the live player before loading', async () => {
  const view = render(<PlayerScreen type="tv" id={1} />);
  await waitFor(() => expect(mockPlayer.play).toHaveBeenCalledTimes(1));
  mockEvents.length = 0;
  fireEvent.press(view.getByText('next'));
  await waitFor(() => expect(mockPlayer.play).toHaveBeenCalledTimes(2));
  expect(mockEvents).toEqual(['pause', 'play']);
  expect(() => view.unmount()).not.toThrow();
});
