import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { getMediaDetails, getSeason } from '../../../api/media';
import type { MobileMediaDetails } from '../../../types/api';
import { PlayerScreen } from '../PlayerScreen';
import NativeCastControls from '../CastControls';

const mockPlayer = {
  currentTime: 0, duration: 0, playing: false,
  play: jest.fn(), pause: jest.fn(), replaceAsync: jest.fn(async () => {}),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
};
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-video', () => ({ VideoView: 'VideoView', useVideoPlayer: () => mockPlayer }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useFocusEffect: jest.fn() }));
jest.mock('react-native/Libraries/Components/TV/useTVEventHandler', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@expo/vector-icons', () => ({ Feather: 'Feather', Ionicons: 'Ionicons', MaterialCommunityIcons: 'MaterialCommunityIcons' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('../../../components/BackButton', () => ({ BackButton: () => null }));
jest.mock('../../../components/Badges', () => ({ TmdbRating: () => null, RtRating: () => null }));
jest.mock('../../../providers/LocaleProvider', () => ({ useLocale: () => ({ locale: 'en', t: (key: string) => key }) }));
jest.mock('../../../api/media', () => ({ getMediaDetails: jest.fn(), getSeason: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../resolveStream', () => ({
  fetchAvailableSources: jest.fn(async () => []),
  selectPlaybackSource: () => null,
}));
jest.mock('../CastControls', () => ({ __esModule: true, default: jest.fn(() => null) }));

const title: MobileMediaDetails = {
  id: 1, mediaType: 'tv', title: 'Saved title', overview: '', posterUrl: null, backdropUrl: null,
  date: '2026-01-01', rating: 7, logoUrl: null, tagline: '', genres: [], cast: [], creators: [], runtime: null,
  contentRating: null, imdbId: null, rottenTomatoesScore: null, seasons: [], related: [],
  stream: { mediaType: 'tv', tmdbId: 1, originalTitle: 'Saved title', year: '2026', imdbId: null },
};
function renderPlayer(type: 'movie' | 'tv') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return render(<QueryClientProvider client={client}><PlayerScreen type={type} id={1} /></QueryClientProvider>);
}
beforeEach(() => { jest.clearAllMocks(); });

test('retries an initial detail request failure and opens a movie full screen', async () => {
  jest.mocked(getMediaDetails).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(title);
  const user = userEvent.setup();
  renderPlayer('movie');
  await waitFor(() => expect(screen.getByText('errorBody')).toBeTruthy());
  await user.press(screen.getByText('retry'));
  await waitFor(() => expect(screen.getByLabelText('cropBars')).toBeTruthy());
  expect(screen.queryByText('Saved title')).toBeNull();
  expect(screen.queryByLabelText('enterFullscreen')).toBeNull();
  expect(getMediaDetails).toHaveBeenCalledTimes(2);
});

test('opens a phone TV show full screen and reloads a failed season in the episode panel without mounting Cast', async () => {
  jest.mocked(getMediaDetails).mockResolvedValue(title);
  jest.mocked(getSeason).mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ showId: 1, seasonNumber: 1, episodes: [] });
  const user = userEvent.setup();
  renderPlayer('tv');
  // No source plays, yet the episode buttons stay so another episode is one tap away.
  await waitFor(() => expect(screen.getByText('streamUnavailable')).toBeTruthy());
  expect(screen.queryByText('Saved title')).toBeNull();
  // The bar's season request failed; opening the panel loads it again.
  await user.press(screen.getByRole('button', { name: 'episodes' }));
  await waitFor(() => expect(screen.getByText('noEpisodes')).toBeTruthy());
  expect(getSeason).toHaveBeenCalledTimes(2);
  expect(NativeCastControls).not.toHaveBeenCalled();
});

test('opens a TV show full screen on Android TV without the episode page', async () => {
  const originalTV = Object.getOwnPropertyDescriptor(Platform, 'isTV');
  Object.defineProperty(Platform, 'isTV', { value: true, configurable: true });
  try {
    jest.mocked(getMediaDetails).mockResolvedValue(title);
    renderPlayer('tv');
    // This title has no sources, so Retry is the only control and takes remote focus.
    await waitFor(() => expect(screen.getByText('streamUnavailable')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'retry' }).props.hasTVPreferredFocus).toBe(true);
    expect(screen.queryByText('Saved title')).toBeNull();
    expect(screen.queryByText('episodes')).toBeNull();
    // Only the playing season loads, for the episode name in the bar; the episode panel loads on demand.
    expect(getSeason).toHaveBeenCalledTimes(1);
  } finally {
    if (originalTV) Object.defineProperty(Platform, 'isTV', originalTV);
  }
});
