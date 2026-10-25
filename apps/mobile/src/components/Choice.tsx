import { Host } from '@expo/ui';
import { View, useColorScheme } from 'react-native';
import { NativePicker } from './NativePicker';
import type { NativePickerProps } from './NativePicker.types';
import { colors, spacing } from '../theme';
export function Choice<T extends string | number>(props: NativePickerProps<T>) {
  const scheme = useColorScheme();
  return <View style={{ padding: spacing.md }}>
    <Host matchContents={{ vertical: true }} colorScheme={scheme} seedColor={colors.accent}>
      <NativePicker {...props} />
    </Host>
  </View>;
}
