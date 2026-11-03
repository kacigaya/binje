import { fireEvent, render } from '@testing-library/react-native';
import { Platform, Text } from 'react-native';
import { TVPressable } from './TVPressable';
import { gridColumnCount } from './mediaGrid';
import { tvFocusStyle } from '../theme';

const originalTV = Object.getOwnPropertyDescriptor(Platform, 'isTV');
beforeEach(() => { Object.defineProperty(Platform, 'isTV', { value: false, writable: true, configurable: true }); });
afterEach(() => { if (originalTV) Object.defineProperty(Platform, 'isTV', originalTV); });

test('keeps two columns on phones at every width', () => {
  Platform.isTV = false;
  expect(gridColumnCount(390)).toBe(2);
  expect(gridColumnCount(1920)).toBe(2);
});

test('fits five or six columns on TV', () => {
  Platform.isTV = true;
  expect(gridColumnCount(960)).toBe(5);
  expect(gridColumnCount(1920)).toBe(6);
});

test.each([false, true])('focus ring is TV-only: %s', tv => {
  Platform.isTV = tv;
  const onFocus = jest.fn();
  const view = render(<TVPressable accessibilityLabel="Open" onFocus={onFocus}><Text>Open</Text></TVPressable>);
  const button = view.getByLabelText('Open');
  fireEvent(button, 'focus', { nativeEvent: {} });
  expect(onFocus).toHaveBeenCalledTimes(1);
  if (tv) expect(button).toHaveStyle(tvFocusStyle);
  else expect(button).not.toHaveStyle(tvFocusStyle);
  fireEvent(button, 'blur', { nativeEvent: {} });
  expect(button).not.toHaveStyle(tvFocusStyle);
});
