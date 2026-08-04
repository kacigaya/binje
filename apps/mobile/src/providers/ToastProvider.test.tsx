import { act, render, screen, userEvent } from '@testing-library/react-native';
import { expect, jest, test } from '@jest/globals';
import { Pressable, Text } from 'react-native';
import { ToastProvider, useToast } from './ToastProvider';

function Trigger({ onAction }: { onAction?: () => void }) {
  const toast = useToast();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => toast.show({ message: 'Removed from watchlist', actionLabel: 'Undo', onAction })}
    >
      <Text>show</Text>
    </Pressable>
  );
}

test('shows a toast message and runs its action', async () => {
  jest.useFakeTimers();
  const user = userEvent.setup();
  const onAction = jest.fn();
  render(
    <ToastProvider>
      <Trigger onAction={onAction} />
    </ToastProvider>,
  );

  expect(screen.queryByText('Removed from watchlist')).toBeNull();

  await user.press(screen.getByText('show'));
  expect(screen.getByText('Removed from watchlist')).toBeTruthy();

  await user.press(screen.getByText('Undo'));
  expect(onAction).toHaveBeenCalledTimes(1);

  act(() => jest.runOnlyPendingTimers());
  jest.useRealTimers();
});

test('auto-dismisses after the timeout', async () => {
  jest.useFakeTimers();
  const user = userEvent.setup();
  render(
    <ToastProvider>
      <Trigger />
    </ToastProvider>,
  );

  await user.press(screen.getByText('show'));
  expect(screen.getByText('Removed from watchlist')).toBeTruthy();

  act(() => jest.advanceTimersByTime(4000));
  act(() => jest.runOnlyPendingTimers());
  expect(screen.queryByText('Removed from watchlist')).toBeNull();
  jest.useRealTimers();
});
