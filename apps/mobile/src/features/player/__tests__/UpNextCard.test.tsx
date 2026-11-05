import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { UP_NEXT_SECONDS, UpNextCard } from '../UpNextCard';

jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('../../../providers/LocaleProvider', () => ({ useLocale: () => ({ locale: 'en', t: (key: string) => key }) }));

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('counts down and plays the next episode once', () => {
  const onPlay = jest.fn();
  render(<UpNextCard label="S1:E2 · Grilled" onPlay={onPlay} onCancel={jest.fn()} />);
  expect(screen.getByText(`startsIn ${UP_NEXT_SECONDS} s`)).toBeTruthy();
  act(() => jest.advanceTimersByTime(3000));
  expect(screen.getByText(`startsIn ${UP_NEXT_SECONDS - 3} s`)).toBeTruthy();
  expect(onPlay).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(UP_NEXT_SECONDS * 1000));
  expect(onPlay).toHaveBeenCalledTimes(1);
});

test('plays now or cancels on request', () => {
  const onPlay = jest.fn();
  const onCancel = jest.fn();
  render(<UpNextCard label="S1:E2" onPlay={onPlay} onCancel={onCancel} />);
  fireEvent.press(screen.getByText('playNow'));
  expect(onPlay).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByText('cancel'));
  expect(onCancel).toHaveBeenCalledTimes(1);
});
