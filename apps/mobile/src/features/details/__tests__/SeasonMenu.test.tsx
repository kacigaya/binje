import { fireEvent, render } from '@testing-library/react-native';
import { SeasonMenu } from '../SeasonMenu';

jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));
jest.mock('../../../providers/LocaleProvider', () => ({ useLocale: () => ({ locale: 'en', t: (key: string) => ({ season: 'Season', episode: 'Episode', episodes: 'Episodes' })[key] ?? key }) }));

const seasons = Array.from({ length: 38 }, (_, index) => ({ id: index + 1, seasonNumber: index + 1, name: `Season ${index + 1}`, episodeCount: index === 1 ? 1 : 13 }));

test('names the season and its episode count, then picks another season from the sheet', () => {
  const onChange = jest.fn();
  const view = render(<SeasonMenu seasons={seasons} season={1} onChange={onChange} />);
  expect(view.getByText('13 episodes')).toBeTruthy();
  fireEvent.press(view.getByLabelText('Season: Season 1'));
  expect(view.getByText('1 episode')).toBeTruthy();
  fireEvent.press(view.getByText('Season 2'));
  expect(onChange).toHaveBeenCalledWith(2);
  expect(view.queryByText('1 episode')).toBeNull();
});
