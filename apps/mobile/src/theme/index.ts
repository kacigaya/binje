// Mirrors web design tokens in app/globals.css
export const colors = {
  background: '#050506',
  surface: '#0c0c0f', // --card
  surfaceAlt: '#1a1a1f', // --secondary / --muted
  text: '#f0f0f0', // --foreground
  muted: '#8a8a8a', // --muted-foreground
  accent: '#e11d48', // --accent-red
  accentPressed: '#be123c',
  destructive: '#ef4444', // --destructive
  border: 'rgba(255,255,255,0.08)', // --border
  borderStrong: 'rgba(255,255,255,0.15)',
  fill: 'rgba(255,255,255,0.08)', // web bg-white/8 pills
  fillActive: 'rgba(255,255,255,0.10)', // web bg-white/10 active pills
  success: '#22c55e',
} as const;
export const fonts = {
  heading: 'SpaceGrotesk_700Bold', // web --font-heading
  headingMedium: 'SpaceGrotesk_500Medium',
  body: 'Outfit_400Regular', // web --font-sans
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
