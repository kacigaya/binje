import { act, renderHook } from '@testing-library/react-native';
import { addToWatchlist } from '../storage/watchlist';
import { useWatchlistToggle } from './useWatchlistToggle';

const mockShow = jest.fn();
jest.mock('../providers/LocaleProvider', () => ({ useLocale: () => ({ t: (key: string) => key }) }));
jest.mock('../providers/ToastProvider', () => ({ useToast: () => ({ show: (...args: unknown[]) => mockShow(...args) }) }));
jest.mock('../storage/watchlist', () => ({ addToWatchlist: jest.fn(), removeFromWatchlist: jest.fn(), getWatchlist: jest.fn(async () => []), subscribeToWatchlist: jest.fn(() => () => {}) }));

beforeEach(() => mockShow.mockClear());

const input = { type: 'movie' as const, id: 1, title: 'Dune', poster_path: null, backdrop_path: null, date: '2021', vote_average: 8 };

test('confirms a save with an undo action', async () => {
  jest.mocked(addToWatchlist).mockResolvedValue(true);
  const { result } = renderHook(() => useWatchlistToggle());
  await act(() => result.current.setSaved(input, true));
  expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({ message: 'addedToWatchlist', actionLabel: 'undo' }));
});

test('reports blocked storage without claiming success', async () => {
  jest.mocked(addToWatchlist).mockResolvedValue(false);
  const onError = jest.fn();
  const { result } = renderHook(() => useWatchlistToggle(onError));
  await act(() => result.current.setSaved(input, true));
  expect(onError).toHaveBeenCalledWith('storageRequired');
  expect(mockShow).not.toHaveBeenCalled();
});
