import { act, render, screen, userEvent } from '@testing-library/react-native';
import { expect, jest, test } from '@jest/globals';
import { Pressable, Text } from 'react-native';
import { ToastProvider, useToast } from './ToastProvider';
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../components/Button', () => ({
  Button: ({ label, onPress }: { label: string; onPress: () => void }) => {
    const { Button } = require('react-native');
    return <Button title={label} onPress={onPress} />;
  },
}));

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
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
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
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
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

function UndoFlow() {
  const toast = useToast();
  return <Pressable accessibilityRole="button" onPress={() => toast.show({
    message: 'Removed', actionLabel: 'Undo', onAction: () => toast.show({ message: 'Restored' }),
  })}><Text>remove</Text></Pressable>;
}

test('keeps the new message when Undo interrupts dismissal', async () => {
  jest.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
  render(<ToastProvider><UndoFlow /></ToastProvider>);
  await user.press(screen.getByText('remove'));
  await user.press(screen.getByText('Undo'));
  await act(async () => { await jest.advanceTimersByTimeAsync(200); });
  expect(screen.getByText('Restored')).toBeTruthy();
  act(() => jest.runOnlyPendingTimers());
  jest.useRealTimers();
});
