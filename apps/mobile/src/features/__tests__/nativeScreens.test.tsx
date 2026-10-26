import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { browseMedia, getHome, getMediaDetails, searchMedia } from '../../api/media';
import { setConsent } from '../../storage/consent';
import type { MobileHomeResponse, MobileMediaDetails, MobileMediaSummary } from '../../types/api';
import HomeScreen from '../home/HomeScreen';
import DetailsScreen from '../details/DetailsScreen';
import BrowseScreen from '../browse/BrowseScreen';
import SearchScreen from '../search/SearchScreen';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../../api/media', () => ({ ...jest.requireActual('../../api/media'), getHome: jest.fn(), getMediaDetails: jest.fn(), browseMedia: jest.fn(), searchMedia: jest.fn() }));
jest.mock('../../providers/LocaleProvider', () => ({ useLocale: () => ({ locale: 'en', t: (key: string) => key }) }));
const mockShow = jest.fn();
jest.mock('../../providers/ToastProvider', () => ({ useToast: () => ({ show: (...args: unknown[]) => mockShow(...args) }) }));
jest.mock('../../components/Screen', () => {
  const { View } = require('react-native');
  return { Screen: View };
});
jest.mock('../../components/Button', () => ({
  Button: ({ label, onPress, disabled, loading }: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean }) => {
    const { Button } = require('react-native');
    return <Button title={label} onPress={onPress} disabled={disabled || loading} />;
  },
}));
jest.mock('../../components/BackButton', () => ({ BackButton: () => null }));
jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('../../components/ContinueWatching', () => ({ ContinueWatching: () => null }));
jest.mock('../../components/MediaCard', () => ({
  MediaCard: ({ item }: { item: MobileMediaSummary }) => {
    const { Text } = require('react-native');
    return <Text>{item.title}</Text>;
  },
}));
jest.mock('../../components/MediaRow', () => ({
  MediaRow: ({ items }: { items: MobileMediaSummary[] }) => {
    const { Text } = require('react-native');
    return <Text>{items.map(item => item.title).join(', ')}</Text>;
  },
}));

const title: MobileMediaDetails = {
  id: 1, mediaType: 'movie', title: 'Saved title', overview: 'A film', posterUrl: null, backdropUrl: null,
  date: '2026-01-01', rating: 7, logoUrl: null, tagline: '', genres: [], cast: [], creators: [], runtime: null,
  contentRating: null, imdbId: null, rottenTomatoesScore: null, seasons: [], related: [],
  stream: { mediaType: 'movie', tmdbId: 1, originalTitle: 'Saved title', year: '2026', imdbId: null },
};
function client() { return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } }); }
beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear(); });

test('keeps cached titles visible when a refresh fails', async () => {
  const queryClient = client();
  const cached: MobileHomeResponse = { featured: [], trendingMovies: [title], trendingTV: [] };
  queryClient.setQueryData(['home', 'en'], cached);
  jest.mocked(getHome).mockRejectedValue(new Error('offline'));
  render(<QueryClientProvider client={queryClient}><HomeScreen /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByText('refreshFailed')).toBeTruthy());
  expect(screen.getByText('Saved title')).toBeTruthy();
});

test('shows blocked and failed saves without success, then permits retry', async () => {
  await setConsent('dismissed');
  jest.mocked(getMediaDetails).mockResolvedValue(title);
  const user = userEvent.setup();
  render(<QueryClientProvider client={client()}><DetailsScreen type="movie" id={1} /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByText('addToWatchlist')).toBeTruthy());
  await user.press(screen.getByText('addToWatchlist'));
  await waitFor(() => expect(screen.getByText('storageRequired')).toBeTruthy());
  expect(mockShow).not.toHaveBeenCalled();
  await setConsent('accepted');
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));
  await user.press(screen.getByText('addToWatchlist'));
  await waitFor(() => expect(screen.getByText('saveFailed')).toBeTruthy());
  expect(mockShow).not.toHaveBeenCalled();
  await user.press(screen.getByText('addToWatchlist'));
  await waitFor(() => expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({ message: 'addedToWatchlist' })));
  await waitFor(() => expect(screen.getByText('removeFromWatchlist')).toBeTruthy());
});

test('keeps loaded browse titles after a next-page failure', async () => {
  const queryClient = client();
  queryClient.setQueryDefaults(['browse'], { staleTime: Infinity });
  queryClient.setQueryData(['browse', 'movie', 'popular', 'en'], {
    pages: [{ page: 1, items: [title] }], pageParams: [1],
  });
  jest.mocked(browseMedia).mockRejectedValue(new Error('offline'));
  render(<QueryClientProvider client={queryClient}><BrowseScreen /></QueryClientProvider>);
  fireEvent(screen.UNSAFE_getAllByType(FlatList)[1], 'endReached');
  await waitFor(() => expect(screen.getByText('errorBody')).toBeTruthy());
  expect(screen.getByText('Saved title')).toBeTruthy();
});

test('keeps cached search results visible after a refresh failure', async () => {
  const queryClient = client();
  queryClient.setQueryData(['search', 'Saved', 'en'], {
    results: [{ id: 1, media_type: 'movie', title: 'Saved title' }],
  });
  jest.mocked(searchMedia).mockRejectedValue(new Error('offline'));
  const user = userEvent.setup();
  render(<QueryClientProvider client={queryClient}><SearchScreen /></QueryClientProvider>);
  await user.type(screen.getByLabelText('search'), 'Saved');
  await waitFor(() => expect(screen.getByText('refreshFailed')).toBeTruthy());
  expect(screen.getByText('Saved title')).toBeTruthy();
});
