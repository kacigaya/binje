import { fireEvent, render, screen } from '@testing-library/react-native';
import type { MobileEpisode, MobileSeason } from '../../../types/api';
import { EpisodePanel } from '../EpisodePanel';

jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));
jest.mock('../../../providers/LocaleProvider', () => ({ useLocale: () => ({ locale: 'en', t: (key: string) => key }) }));

const seasons = [1, 2].map((number) => ({ id: number, name: `Season ${number}`, overview: '', posterUrl: null, seasonNumber: number, episodeCount: 3, airDate: '' })) as MobileSeason[];
const episodes = [1, 2, 3].map((number) => ({ id: number, name: `Chapter ${number}`, overview: '', episodeNumber: number, seasonNumber: 1, stillUrl: null, airDate: null, runtime: null, rating: 0 })) as MobileEpisode[];

function renderPanel(props: Partial<Parameters<typeof EpisodePanel>[0]> = {}) {
  const handlers = { onSeasonChange: jest.fn(), onSelect: jest.fn(), onRetry: jest.fn() };
  render(<EpisodePanel title="Show" seasons={seasons} season={1} episodes={episodes} loading={false} failed={false} playingSeason={1} playingEpisode={2} {...handlers} {...props} />);
  return handlers;
}

test('focuses the playing episode and selects another one', () => {
  const { onSelect, onSeasonChange } = renderPanel();
  expect(screen.getByLabelText('2. Chapter 2').props.hasTVPreferredFocus).toBe(true);
  expect(screen.getByLabelText('1. Chapter 1').props.hasTVPreferredFocus).toBe(false);
  expect(screen.getByText('watching')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('3. Chapter 3'));
  expect(onSelect).toHaveBeenCalledWith(3);
  fireEvent.press(screen.getByText('Season 2'));
  expect(onSeasonChange).toHaveBeenCalledWith(2);
});

test('marks nothing as playing while browsing another season', () => {
  renderPanel({ season: 2 });
  expect(screen.queryByText('watching')).toBeNull();
});

test('offers a focused retry when the season fails', () => {
  const { onRetry } = renderPanel({ failed: true, episodes: [] });
  fireEvent.press(screen.getByText('retry'));
  expect(onRetry).toHaveBeenCalled();
});

test('offers a close button on phones', () => {
  const onClose = jest.fn();
  renderPanel({ onClose });
  fireEvent.press(screen.getByLabelText('close'));
  expect(onClose).toHaveBeenCalled();
});
