import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { ThemeProvider, DarkTheme, DefaultTheme } from 'expo-router/react-navigation';
import { getLocales } from 'expo-localization';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Button, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { AppProviders } from '../providers/AppProviders';
import { useLocale } from '../providers/LocaleProvider';
import { localeFromTags, translate } from '../i18n';
import { colors, spacing } from '../theme';

void SplashScreen.preventAutoHideAsync();
export const unstable_settings = { initialRouteName: '(tabs)' };

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useColorScheme();
  const locale = localeFromTags(getLocales().map(item => item.languageTag ?? item.languageCode));
  useEffect(() => { void SplashScreen.hideAsync(); }, []);
  return <View style={styles.error}>
    <Text selectable style={{ color: colors.text }}>{error.message || translate(locale, 'errorBody')}</Text>
    <Button title={translate(locale, 'retry')} onPress={() => void retry()} />
  </View>;
}
function Navigation() {
  const scheme = useColorScheme();
  const { isLoading, t } = useLocale();
  useEffect(() => { if (!isLoading) void SplashScreen.hideAsync(); }, [isLoading]);
  if (isLoading) return null;
  return <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
    <StatusBar style="auto" />
    <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background }, headerTintColor: colors.accent, headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="privacy" options={{ title: t('privacyPolicy') }} />
      <Stack.Screen name="settings" options={{ title: t('settings') }} />
      <Stack.Screen name="watch/movie/[id]" options={{ title: t('watchNow'), orientation: 'all' }} />
      <Stack.Screen name="watch/tv/[id]" options={{ title: t('watchNow'), orientation: 'all' }} />
      <Stack.Screen name="movie/[id]" options={{ title: t('details') }} />
      <Stack.Screen name="tv/[id]" options={{ title: t('details') }} />
    </Stack>
  </ThemeProvider>;
}
export default function RootLayout() { return <AppProviders><Navigation /></AppProviders>; }
const styles = StyleSheet.create({ error: { flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.md, backgroundColor: colors.background } });
