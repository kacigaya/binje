import { render, screen } from '@testing-library/react-native';
import { MediaCard } from './MediaCard';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('../providers/LocaleProvider', () => ({ useLocale: () => ({ locale: 'en', t: (key: string) => key }) }));
jest.mock('../hooks/useWatchlistToggle', () => ({ useIsInWatchlist: () => false, useWatchlistToggle: () => ({ setSaved: jest.fn(), pending: false }) }));

const item = { id: 1, mediaType: 'movie' as const, title: 'Dune', overview: '', posterUrl: null, backdropUrl: null, date: '2021-09-15', rating: 0 };

test('shows N/A for unrated titles', () => {
  render(<MediaCard item={item} />);
  expect(screen.queryByText('0.0')).toBeNull();
  expect(screen.getByText('notAvailable')).toBeTruthy();
});

test('offers a labeled watchlist toggle', () => {
  render(<MediaCard item={item} />);
  expect(screen.getByLabelText('addToWatchlist: Dune')).toBeTruthy();
});

test('shows the rating and a localized accessibility label', () => {
  render(<MediaCard item={{ ...item, mediaType: 'tv', rating: 7.84 }} />);
  expect(screen.getByText('7.8')).toBeTruthy();
  expect(screen.getByLabelText('Dune, tvSeries, 2021')).toBeTruthy();
});
