import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from "@expo-google-fonts/outfit";
import { useFonts } from "expo-font";
import { getLocales } from "expo-localization";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { localeFromTags, translate } from "../i18n";
import { AppProviders } from "../providers/AppProviders";
import { useLocale } from "../providers/LocaleProvider";
import { colors, fonts, spacing } from "../theme";

void SplashScreen.preventAutoHideAsync();
export const unstable_settings = { initialRouteName: '(tabs)' };

/** This boundary renders outside AppProviders, so it must resolve its own locale. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => { void SplashScreen.hideAsync(); }, []);
  const locale = localeFromTags(
    getLocales().map((item) => item.languageTag ?? item.languageCode),
  );

  return (
    <View style={errorStyles.box}>
      <Text style={errorStyles.title}>{translate(locale, "errorTitle")}</Text>
      <Text style={errorStyles.body}>
        {error.message || translate(locale, "errorBody")}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => void retry()}
        style={errorStyles.button}
      >
        <Text style={errorStyles.buttonText}>{translate(locale, "retry")}</Text>
      </Pressable>
    </View>
  );
}

const errorStyles = StyleSheet.create({
  box: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  title: { color: colors.text, fontSize: 18, fontFamily: fonts.heading, textAlign: "center" },
  body: { color: colors.muted, fontFamily: fonts.body, textAlign: "center" },
  button: {
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    minHeight: 44,
    justifyContent: "center",
    borderRadius: 99,
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontFamily: fonts.bodySemiBold },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <AppProviders>
      <AppNavigation />
    </AppProviders>
  );
}

function AppNavigation() {
  const { isLoading } = useLocale();
  useEffect(() => {
    if (!isLoading) void SplashScreen.hideAsync();
  }, [isLoading]);
  if (isLoading) return null;
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          orientation: 'portrait',
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="watch/movie/[id]" options={{ orientation: 'all' }} />
        <Stack.Screen name="watch/tv/[id]" options={{ orientation: 'all' }} />
      </Stack>
    </>
  );
}
