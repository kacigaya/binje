import { useEffect, useEffectEvent, useState } from "react";
import { Image } from "expo-image";
import { Platform, StyleSheet, Text, View } from "react-native";
import { TVPressable as Pressable } from "../../components/TVPressable";
import { useLocale } from "../../providers/LocaleProvider";
import { colors, fonts, screenPadding } from "../../theme";

export const UP_NEXT_SECONDS = 10;
const INK = "#0a0a0b";

/** Shown when an episode ends: counts down, then plays the next one unless the viewer cancels. */
export function UpNextCard({ label, stillUrl, onPlay, onCancel }: {
  /** Such as "S1:E2 · Cat's in the Bag". */
  label: string;
  stillUrl?: string | null;
  onPlay: () => void;
  onCancel: () => void;
}) {
  const { t } = useLocale();
  const [left, setLeft] = useState(UP_NEXT_SECONDS);
  // The timer must not restart when the parent passes a new callback.
  const play = useEffectEvent(onPlay);

  useEffect(() => {
    const timer = setInterval(() => setLeft((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { if (left === 0) play(); }, [left]);

  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      {stillUrl ? <Image source={stillUrl} alt="" style={styles.still} contentFit="cover" /> : null}
      <View style={styles.body}>
        <Text style={styles.caption}>{t("upNext")}</Text>
        <Text numberOfLines={2} style={styles.title}>{label}</Text>
        <Text style={styles.countdown}>{t("startsIn")} {left} s</Text>
        <View style={styles.track}><View style={[styles.fill, { width: `${(left / UP_NEXT_SECONDS) * 100}%` }]} /></View>
        <View style={styles.actions}>
          <Pressable hasTVPreferredFocus accessibilityRole="button" onPress={onPlay} focusStyle={styles.focused} style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}>
            <Text style={[styles.buttonText, { color: INK }]}>{t("playNow")}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onCancel} focusStyle={styles.focusedSecondary} style={({ pressed }) => [styles.button, styles.secondary, pressed && styles.pressed]}>
            {({ focused }) => <Text style={[styles.buttonText, { color: Platform.isTV && focused ? INK : colors.text }]}>{t("cancel")}</Text>}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const tv = Platform.isTV;
const textShadow = { textShadowColor: "rgba(0,0,0,0.85)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 };
const styles = StyleSheet.create({
  // No panel behind the content: each part sits on the video and shadows keep it readable.
  card: { position: "absolute", right: tv ? screenPadding : 16, bottom: tv ? 32 : 16, width: tv ? 440 : 340, flexDirection: "row", gap: 14 },
  still: { alignSelf: "flex-start", width: tv ? 160 : 112, aspectRatio: 16 / 9, borderRadius: 10, backgroundColor: colors.surfaceAlt, boxShadow: "0 8px 24px rgba(0,0,0,0.6)" },
  body: { flex: 1, gap: 4 },
  caption: { ...textShadow, color: colors.accentText, fontSize: tv ? 14 : 12, fontFamily: fonts.bodySemiBold, letterSpacing: 0.6, textTransform: "uppercase" },
  title: { ...textShadow, color: colors.text, fontSize: tv ? 18 : 15, fontFamily: fonts.bodySemiBold },
  countdown: { ...textShadow, color: "rgba(255,255,255,0.85)", fontSize: tv ? 15 : 13, fontFamily: fonts.body, fontVariant: ["tabular-nums"] },
  track: { height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden", marginVertical: 4, boxShadow: "0 1px 6px rgba(0,0,0,0.6)" },
  fill: { height: 3, backgroundColor: colors.accent },
  actions: { flexDirection: "row", gap: 8, marginTop: 4 },
  button: { height: tv ? 48 : 36, borderRadius: 999, paddingHorizontal: tv ? 20 : 14, alignItems: "center", justifyContent: "center", boxShadow: "0 6px 18px rgba(0,0,0,0.5)" },
  primary: { backgroundColor: "#fff" },
  secondary: { backgroundColor: "rgba(20,20,24,0.7)" },
  pressed: { opacity: 0.8 },
  buttonText: { fontSize: tv ? 16 : 13, fontFamily: fonts.bodySemiBold },
  // TV focus: a scale on the white button, an inverted fill on the quiet one.
  focused: { transform: [{ scale: 1.08 }], outlineWidth: 3, outlineColor: colors.accent, outlineOffset: 3 },
  focusedSecondary: { backgroundColor: "#fff", transform: [{ scale: 1.08 }] },
});
