import { render, screen } from '@testing-library/react-native';
import { MediaCard } from './MediaCard';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('../providers/LocaleProvider', () => ({ useLocale: () => ({ t: (key: string) => key }) }));

const item = { id: 1, mediaType: 'movie' as const, title: 'Dune', overview: '', posterUrl: null, backdropUrl: null, date: '2021-09-15', rating: 0 };

test('hides the rating badge for unrated titles', () => {
  render(<MediaCard item={item} />);
  expect(screen.queryByText('0.0')).toBeNull();
});

test('shows the rating and a localized accessibility label', () => {
  render(<MediaCard item={{ ...item, mediaType: 'tv', rating: 7.84 }} />);
  expect(screen.getByText('7.8')).toBeTruthy();
  expect(screen.getByLabelText('Dune, tvSeries, 2021')).toBeTruthy();
});
