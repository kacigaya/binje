import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { VideoPlayer } from "expo-video";
import { useLocale } from "../../providers/LocaleProvider";
import { colors, fonts } from "../../theme";

export const SEEK_STEP = 10;
const HIDE_AFTER_MS = 3000;

// The player is a native handle; seeking means writing its position.
function seekTo(player: VideoPlayer, seconds: number) { player.currentTime = seconds; }

export function formatTime(seconds: number) {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** Mirrors the web player overlay on phones: toolbar on top, skip/play in the center, seek bar at the bottom. */
export function PlayerControls({ player, toolbar, crop, onCrop, onFullscreen, onPip, disabled }: {
  player: VideoPlayer;
  toolbar?: ReactNode;
  crop: boolean;
  onCrop: () => void;
  onFullscreen: () => void;
  onPip: () => void;
  disabled?: boolean;
}) {
  const { t } = useLocale();
  const [visible, setVisible] = useState(true);
  const [playing, setPlaying] = useState(player.playing);
  const [time, setTime] = useState(player.currentTime);
  const [duration, setDuration] = useState(player.duration);
  const [buffering, setBuffering] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const subs = [
      player.addListener("playingChange", ({ isPlaying }) => setPlaying(isPlaying)),
      player.addListener("timeUpdate", ({ currentTime }) => { setTime(currentTime); setDuration(player.duration); }),
      player.addListener("statusChange", ({ status }) => setBuffering(status === "loading")),
    ];
    return () => subs.forEach((sub) => sub.remove());
  }, [player]);

  // Keep controls up while paused; hide them after a short delay while playing, like the web player.
  useEffect(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (visible && playing) hideTimer.current = setTimeout(() => setVisible(false), HIDE_AFTER_MS);
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [visible, playing, time]);

  const skip = (forward: boolean) => {
    const target = player.currentTime + (forward ? SEEK_STEP : -SEEK_STEP);
    const next = Math.max(0, duration > 0 ? Math.min(target, duration) : target);
    seekTo(player, next);
    setTime(next);
  };
  const toggle = () => { if (player.playing) player.pause(); else player.play(); };

  if (!visible) {
    return <Pressable accessibilityRole="button" accessibilityLabel={t("showControls")} onPress={() => setVisible(true)} style={StyleSheet.absoluteFill} />;
  }
  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable accessibilityElementsHidden importantForAccessibility="no" onPress={() => setVisible(false)} style={StyleSheet.absoluteFill} />
      <LinearGradient pointerEvents="none" colors={["rgba(0,0,0,0.6)", "transparent"]} style={[styles.shade, styles.shadeTop]} />
      <LinearGradient pointerEvents="none" colors={["transparent", "rgba(0,0,0,0.8)"]} style={[styles.shade, styles.shadeBottom]} />
      <View style={styles.toolbar}>
        <View style={styles.group}>
          {toolbar}
          <IconButton label={t("cropBars")} selected={crop} disabled={disabled} onPress={onCrop} icon="crop" />
          <IconButton label={t("pictureInPicture")} disabled={disabled} onPress={onPip} icon="albums-outline" />
          <IconButton label={t("enterFullscreen")} disabled={disabled} onPress={onFullscreen} icon="expand" />
        </View>
      </View>
      {disabled ? null : (
        <View pointerEvents="box-none" style={styles.center}>
          <IconButton label={t("back10")} onPress={() => skip(false)} icon="play-back" round />
          <IconButton label={playing ? t("pause") : t("play")} onPress={toggle} icon={playing ? "pause" : "play"} round large busy={buffering} />
          <IconButton label={t("forward10")} onPress={() => skip(true)} icon="play-forward" round />
        </View>
      )}
      <View style={styles.bottom}>
        <SeekBar time={time} duration={duration} disabled={disabled || duration <= 0} onSeek={(value) => { seekTo(player, value); setTime(value); }} />
        <View style={styles.times}>
          <Text style={styles.time}>{formatTime(time)}</Text>
          <Text style={styles.time}>{formatTime(duration)}</Text>
        </View>
      </View>
    </View>
  );
}

function IconButton({ label, icon, onPress, selected, disabled, round, large, busy }: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  round?: boolean;
  large?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected, busy }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.button, round && styles.round, large && styles.large, selected && styles.selected, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={large ? 26 : 18} color="#fff" />
    </Pressable>
  );
}

function SeekBar({ time, duration, disabled, onSeek }: { time: number; duration: number; disabled?: boolean; onSeek: (seconds: number) => void }) {
  const { t } = useLocale();
  const [width, setWidth] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const at = (event: GestureResponderEvent) => width > 0 ? Math.min(1, Math.max(0, event.nativeEvent.locationX / width)) * duration : 0;
  const position = scrub ?? time;
  const progress = duration > 0 ? Math.min(1, position / duration) : 0;
  const step = (forward: boolean) => onSeek(Math.min(duration, Math.max(0, time + (forward ? SEEK_STEP : -SEEK_STEP))));
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={t("seek")}
      accessibilityValue={{ text: `${formatTime(position)} / ${formatTime(duration)}` }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={({ nativeEvent }) => step(nativeEvent.actionName === "increment")}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => !disabled}
      onMoveShouldSetResponder={() => !disabled}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(event) => setScrub(at(event))}
      onResponderMove={(event) => setScrub(at(event))}
      onResponderRelease={(event) => { onSeek(at(event)); setScrub(null); }}
      onResponderTerminate={() => setScrub(null)}
      hitSlop={{ top: 12, bottom: 12 }}
      style={styles.track}
    >
      <View pointerEvents="none" style={styles.rail}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
      <View pointerEvents="none" style={[styles.thumb, { left: `${progress * 100}%` }, scrub !== null && styles.thumbActive]} />
    </View>
  );
}

const styles = StyleSheet.create({
  shade: { position: "absolute", left: 0, right: 0 },
  shadeTop: { top: 0, height: 80 },
  shadeBottom: { bottom: 0, height: 96 },
  toolbar: { position: "absolute", top: 8, right: 8, left: 8, alignItems: "flex-end" },
  group: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "rgba(12,12,15,0.7)", borderRadius: 999, padding: 3 },
  center: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 32 },
  button: { width: 36, height: 36, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  round: { width: 44, height: 44, backgroundColor: "rgba(0,0,0,0.4)" },
  large: { width: 56, height: 56, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(0,0,0,0.6)" },
  selected: { backgroundColor: colors.accent },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
  bottom: { position: "absolute", left: 12, right: 12, bottom: 6 },
  track: { height: 20, justifyContent: "center" },
  rail: { height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden" },
  fill: { height: 4, backgroundColor: colors.accent },
  thumb: { position: "absolute", width: 12, height: 12, marginLeft: -6, borderRadius: 6, backgroundColor: "#fff" },
  thumbActive: { width: 16, height: 16, marginLeft: -8, borderRadius: 8 },
  times: { flexDirection: "row", justifyContent: "space-between" },
  time: { color: "rgba(255,255,255,0.85)", fontSize: 11, fontFamily: fonts.bodyMedium, fontVariant: ["tabular-nums"] },
});
