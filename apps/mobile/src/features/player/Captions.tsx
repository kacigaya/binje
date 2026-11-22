import { useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import type { VideoPlayer } from "expo-video";
import { fonts } from "../../theme";
import { indexCues, type Cue } from "./subtitles";

// The player reports its position every 0.25 s. A cue edge before the next report gets its own update.
const TICK_MS = 250;

/**
 * Draws the cues for the player's position. Key it by track so new cues start from the current position.
 * Screen readers skip it: the audio carries the same words.
 */
export function Captions({ player, cues }: { player: Pick<VideoPlayer, "currentTime" | "playing" | "playbackRate" | "addListener">; cues: readonly Cue[] }) {
  const cueAt = useMemo(() => indexCues(cues), [cues]);
  const [text, setText] = useState(() => cueAt(player.currentTime).text);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = (time: number) => {
      clearTimeout(timer);
      const { text, edge } = cueAt(time);
      setText(text);
      if (!player.playing || edge === undefined) return;
      const delay = ((edge - time) / (player.playbackRate || 1)) * 1000;
      // A few extra milliseconds put the read just past the edge.
      if (delay < TICK_MS) timer = setTimeout(() => update(player.currentTime), delay + 5);
    };
    const subscription = player.addListener("timeUpdate", ({ currentTime }) => update(currentTime));
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [player, cueAt]);
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
