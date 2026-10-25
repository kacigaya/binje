import { Color } from 'expo-router';
import { Platform } from 'react-native';

export const colors = {
  background: Platform.select({ ios: Color.ios.systemBackground, android: Color.android.dynamic.surface, default: '#ffffff' }),
  surface: Platform.select({ ios: Color.ios.secondarySystemBackground, android: Color.android.dynamic.surfaceContainer, default: '#f2f2f7' }),
  surfaceAlt: Platform.select({ ios: Color.ios.tertiarySystemBackground, android: Color.android.dynamic.surfaceContainerHigh, default: '#e5e5ea' }),
  text: Platform.select({ ios: Color.ios.label, android: Color.android.dynamic.onSurface, default: '#1c1c1e' }),
  muted: Platform.select({ ios: Color.ios.secondaryLabel, android: Color.android.dynamic.onSurfaceVariant, default: '#636366' }),
  accent: '#be123c',
  accentPressed: '#9f1239',
  destructive: Platform.select({ ios: Color.ios.systemRed, android: Color.android.dynamic.error, default: '#b91c1c' }),
  border: Platform.select({ ios: Color.ios.separator, android: Color.android.dynamic.outlineVariant, default: '#c7c7cc' }),
  borderStrong: Platform.select({ ios: Color.ios.opaqueSeparator, android: Color.android.dynamic.outline, default: '#8e8e93' }),
  fill: Platform.select({ ios: Color.ios.tertiarySystemFill, android: Color.android.dynamic.surfaceContainer, default: '#f2f2f7' }),
  fillActive: Platform.select({ ios: Color.ios.secondarySystemFill, android: Color.android.dynamic.surfaceContainerHigh, default: '#e5e5ea' }),
  success: '#15803d',
  onMedia: '#ffffff',
  mediaBackground: '#000000',
} as const;
const regular = Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui' });
const medium = Platform.select({ ios: 'System', android: 'sans-serif-medium', default: 'system-ui' });
export const fonts = { heading: medium, headingMedium: medium, body: regular, bodyMedium: medium, bodySemiBold: medium, bodyBold: medium } as const;
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 20, xl: 32, pill: 999 } as const;
export const typography = {
  title: { fontSize: 30, fontFamily: fonts.heading, fontWeight: '700' },
  heading: { fontSize: 21, fontFamily: fonts.heading, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 25, fontFamily: fonts.body },
  label: { fontSize: 15, fontFamily: fonts.bodySemiBold },
} as const;
