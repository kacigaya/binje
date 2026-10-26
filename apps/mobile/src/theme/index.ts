export const colors = {
  background: '#050506',
  surface: '#0c0c0f',
  surfaceAlt: '#1a1a1f',
  text: '#f0f0f0',
  muted: '#8a8a8a',
  accent: '#e11d48',
  accentPressed: '#be123c',
  destructive: '#ef4444',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.15)',
  fill: 'rgba(255,255,255,0.08)',
  fillActive: 'rgba(255,255,255,0.10)',
  success: '#22c55e',
} as const;
export const fonts = {
  heading: 'SpaceGrotesk_700Bold',
  headingMedium: 'SpaceGrotesk_500Medium',
  body: 'Outfit_400Regular',
  bodyMedium: 'Outfit_500Medium',
  bodySemiBold: 'Outfit_600SemiBold',
  bodyBold: 'Outfit_700Bold',
} as const;
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 20, xl: 32, pill: 999 } as const;
export const typography = {
  title: { fontSize: 30, fontFamily: fonts.heading },
  heading: { fontSize: 21, fontFamily: fonts.heading },
  body: { fontSize: 16, lineHeight: 24, fontFamily: fonts.body },
  label: { fontSize: 14, fontFamily: fonts.bodySemiBold },
} as const;
