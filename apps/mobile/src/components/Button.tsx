import { Button as NativeButton, Host } from '@expo/ui';
import { useColorScheme, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../theme';

export function Button({ label, onPress, secondary = false, disabled = false, loading = false, style }: {
  label: string; onPress: () => void; secondary?: boolean; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const scheme = useColorScheme();
  return <Host matchContents={{ vertical: true }} colorScheme={scheme} seedColor={colors.accent} style={[{ minHeight: 48, justifyContent: 'center' }, style]}>
    <NativeButton label={loading ? `${label}…` : label} onPress={onPress} variant={secondary ? 'outlined' : 'filled'} disabled={disabled || loading} style={{ paddingVertical: 8, paddingHorizontal: 16 }} />
  </Host>;
}
