import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { getMediaDetails, getSeason } from '../../../api/media';
import type { MobileMediaDetails } from '../../../types/api';
import { PlayerScreen } from '../PlayerScreen';
import NativeCastControls from '../CastControls';

const mockPlayer = {
  currentTime: 0, duration: 0, playing: false,
  play: jest.fn(), pause: jest.fn(), replaceAsync: jest.fn(async () => {}),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
};
jest.mock('expo-video', () => ({ VideoView: 'VideoView', useVideoPlayer: () => mockPlayer }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
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

test('retries an initial detail request failure', async () => {
  jest.mocked(getMediaDetails).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(title);
  const user = userEvent.setup();
  renderPlayer('movie');
  await waitFor(() => expect(screen.getByText('errorBody')).toBeTruthy());
  await user.press(screen.getByText('retry'));
  await waitFor(() => expect(screen.getByText('Saved title')).toBeTruthy());
  expect(getMediaDetails).toHaveBeenCalledTimes(2);
});

test('retries a failed season request without rendering an empty season or mounting Cast', async () => {
  jest.mocked(getMediaDetails).mockResolvedValue(title);
  jest.mocked(getSeason).mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ showId: 1, seasonNumber: 1, episodes: [] });
  const user = userEvent.setup();
  renderPlayer('tv');
  await waitFor(() => expect(screen.getByText('errorBody')).toBeTruthy());
  expect(screen.queryByText('noEpisodes')).toBeNull();
  await user.press(screen.getAllByText('retry').at(-1)!);
  await waitFor(() => expect(screen.getByText('noEpisodes')).toBeTruthy());
  expect(getSeason).toHaveBeenCalledTimes(2);
  expect(NativeCastControls).not.toHaveBeenCalled();
});
