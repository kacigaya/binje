import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import type { VideoPlayer } from "expo-video";
import { fonts } from "../../theme";
import { activeCueText, type Cue } from "./subtitles";

/**
 * Draws the cues for the player's position. Key it by track so new cues start from the current position.
 * Screen readers skip it: the audio carries the same words.
 */
export function Captions({ player, cues }: { player: Pick<VideoPlayer, "currentTime" | "addListener">; cues: readonly Cue[] }) {
  const [text, setText] = useState(() => activeCueText(cues, player.currentTime));
  useEffect(() => {
    const subscription = player.addListener("timeUpdate", ({ currentTime }) => setText(activeCueText(cues, currentTime)));
    return () => subscription.remove();
  }, [player, cues]);
  if (!text) return null;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.box}>
      <Text style={[styles.text, Platform.isTV && styles.tvText]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { maxWidth: "85%", borderRadius: 6, backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 10, paddingVertical: 4 },
  text: { color: "#fff", fontSize: 17, lineHeight: 23, fontFamily: fonts.bodyMedium, textAlign: "center" },
  tvText: { fontSize: 30, lineHeight: 40 },
});
