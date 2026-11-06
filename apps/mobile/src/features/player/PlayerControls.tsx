import { useFocusEffect } from 'expo-router';
import { tvPlaybackAction, seekPosition } from './tvRemote';
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { TVPressable as Pressable } from '../../components/TVPressable'; import { Animated, BackHandler, Easing, Platform, useTVEventHandler, StyleSheet, Text, TVFocusGuideView, View, type HWEvent, type GestureResponderEvent } from "react-native";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import type { VideoPlayer } from "expo-video";
import type { EdgeInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useLocale } from "../../providers/LocaleProvider";
import { colors, fonts, screenPadding } from "../../theme";

export const SEEK_STEP = 10;
const HIDE_AFTER_MS = 2500;
const DOUBLE_TAP_MS = 300;
/** TV focus inverts controls: a white fill with dark icons and text, readable from across a room. */
const TV_INK = "#0a0a0b";

const NO_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
// Caption distance from the safe-area bottom: clear of the bar while it shows, near the edge otherwise.
const CAPTION_LIFT = { phone: 20, phoneBar: 64, phoneEpisodes: 96, tv: 56, tvBar: 280 };

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
export function PlayerControls({ player, insets = NO_INSETS, captions, leading, heading, hideBar, episodeButtons, toolbar, crop, onCrop, onFullscreen, onPip, disabled, status, menuOpen, onCloseMenu }: {
  player: VideoPlayer;
  /** Safe area for the buttons and bar. Shades and the loading dim still cover the full screen, under a notch too. */
  insets?: EdgeInsets;
  /** Subtitles. They sit above the bar while it shows. */
  captions?: ReactNode;
  /** Rendered at the start of the top row, such as a back button in full screen. */
  leading?: ReactNode;
  /** TV only: what is playing, shown above the progress bar. */
  heading?: { title: string; logoUrl?: string | null; subtitle?: string };
  /** Hides the controls while a panel or card takes their place. */
  hideBar?: boolean;
  /** Episode buttons: in the middle of the TV bar, under the progress bar on phones. */
  episodeButtons?: ReactNode;
  /** Rendered after the built-in toolbar buttons, like quality and cast on the web. */
  toolbar?: ReactNode;
  crop: boolean;
  onCrop: () => void;
  /** Omitted when the screen is already full screen. */
  onFullscreen?: () => void;
  onPip: () => void;
  disabled?: boolean;
  /** Loading text. It dims the video and hides the center buttons. */
  status?: string | null;
  /** An open toolbar menu keeps the controls up; a tap on the video closes it. */
  menuOpen?: boolean;
  onCloseMenu?: () => void;
}) {
  const { t } = useLocale();
  const [visible, setVisible] = useState(true);
  const [playing, setPlaying] = useState(player.playing);
  const [time, setTime] = useState(player.currentTime);
  const [duration, setDuration] = useState(player.duration);
  const [buffered, setBuffered] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [interaction, setInteraction] = useState(0);
  const [seekHint, setSeekHint] = useState<{ forward: boolean; id: number } | null>(null);
  // A drag on the progress bar must not lose its position to the auto-hide timer.
  const [scrubbing, setScrubbing] = useState(false);
  const [width, setWidth] = useState(0);
  const playButton = useRef<View>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef(0);
  // Read on key-up, after the focus event for the same press.
  const seekFocused = useRef(false);

  useEffect(() => {
    const subs = [
      player.addListener("playingChange", ({ isPlaying }) => setPlaying(isPlaying)),
      player.addListener("timeUpdate", ({ currentTime, bufferedPosition }) => { setTime(currentTime); setDuration(player.duration); setBuffered(bufferedPosition); }),
      player.addListener("statusChange", ({ status }) => setBuffering(status === "loading")),
    ];
    return () => subs.forEach((sub) => sub.remove());
  }, [player]);

  // Keep controls up while paused or a menu is open; hide them after a short delay while playing, like the web player.
  useEffect(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (visible && playing && !menuOpen && !scrubbing) hideTimer.current = setTimeout(() => setVisible(false), HIDE_AFTER_MS);
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [visible, playing, menuOpen, scrubbing, interaction]);

  useEffect(() => {
    if (!seekHint) return;
    const timer = setTimeout(() => setSeekHint(null), 500);
    return () => clearTimeout(timer);
  }, [seekHint]);

  const reveal = () => { setVisible(true); setInteraction(value => value + 1); };
  const skip = (forward: boolean) => {
    const next = seekPosition(player.currentTime, duration, forward ? SEEK_STEP : -SEEK_STEP);
    seekTo(player, next);
    setTime(next);
    reveal();
  };
  const toggle = () => { if (player.playing) player.pause(); else player.play(); reveal(); };

  // Tap shows or hides controls; a double tap on either side skips, as on the web.
  const onSurfacePress = (event: GestureResponderEvent) => {
    if (menuOpen) { onCloseMenu?.(); return; }
    const x = width > 0 ? event.nativeEvent.locationX / width : 0.5;
    const now = Date.now();
    const doubleTap = now - lastTap.current < DOUBLE_TAP_MS;
    lastTap.current = doubleTap ? 0 : now;
    if (doubleTap && !disabled && !status && (x < 0.35 || x > 0.65)) {
      skip(x > 0.65);
      setSeekHint({ forward: x > 0.65, id: now });
    } else if (!visible || !playing) {
      reveal();
    } else {
      setVisible(false);
    }
  };

  const handleBack = () => {
    if (menuOpen) { onCloseMenu?.(); return true; }
    if (!visible) return false;
    setVisible(false);
    return true;
  };

  const handleRemote = (event: HWEvent) => {
    if (!Platform.isTV || event.eventType === 'blur' || event.eventType === 'focus' || event.eventType === 'menu') return;
    // The focused progress bar takes left and right. Held keys send key-down repeats, so it also scrubs while held.
    if (visible && seekFocused.current && !disabled && (event.eventType === 'left' || event.eventType === 'right')) {
      skip(event.eventType === 'right');
      return;
    }
    if (event.eventKeyAction === 0) return;
    const wasHidden = !visible;
    reveal();
    if (wasHidden) requestAnimationFrame(() => playButton.current?.requestTVFocus());
    if (disabled) return;
    const action = tvPlaybackAction(event.eventType, event.eventKeyAction, !wasHidden);
    if (action === 'rewind') skip(false);
    if (action === 'forward') skip(true);
    if (action === 'toggle') toggle();
    if (action === 'play') player.play();
    if (action === 'pause') player.pause();
  };

  const safeArea = [StyleSheet.absoluteFill, { top: insets.top, right: insets.right, bottom: insets.bottom, left: insets.left }];
  const barShown = visible && !hideBar && !disabled;
  const captionLift = Platform.isTV ? (barShown ? CAPTION_LIFT.tvBar : CAPTION_LIFT.tv) : barShown ? (episodeButtons ? CAPTION_LIFT.phoneEpisodes : CAPTION_LIFT.phoneBar) : CAPTION_LIFT.phone;
  const layer = (
    <>
      {Platform.isTV ? <TVRemoteEvents onEvent={handleRemote} onBack={handleBack} /> : null}
      {captions && !status ? <View pointerEvents="none" style={[safeArea, styles.captions, { paddingBottom: captionLift }]}>{captions}</View> : null}
      {status || buffering ? (
        <View pointerEvents="none" style={[styles.status, status ? styles.statusDim : null]}>
          <Spinner />
          {status ? <Text accessibilityLiveRegion="polite" style={styles.statusText}>{status}</Text> : null}
        </View>
      ) : null}
      {seekHint ? (
        <View pointerEvents="none" style={safeArea}>
          <View key={seekHint.id} style={[styles.seekHint, seekHint.forward ? styles.seekHintForward : styles.seekHintBack]}>
            <SkipIcon forward={seekHint.forward} />
          </View>
        </View>
      ) : null}
    </>
  );

  // A panel or the Up next prompt replaces the controls, even after they auto-hid. The bottom shade stays so text reads on bright video.
  if (hideBar) {
    return (
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {layer}
        <LinearGradient pointerEvents="none" colors={["transparent", "rgba(0,0,0,0.6)", "rgba(0,0,0,0.92)"]} locations={[0, 0.45, 1]} style={[styles.shade, Platform.isTV ? styles.tvShade : styles.shadeHidden]} />
      </View>
    );
  }

  if (!visible) {
    return (
      <View style={StyleSheet.absoluteFill} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {layer}
        <Pressable hasTVPreferredFocus={Platform.isTV} accessibilityRole="button" accessibilityLabel={t("showControls")} onPress={Platform.isTV ? reveal : onSurfacePress} style={StyleSheet.absoluteFill} />
      </View>
    );
  }
  const seekBar = (
    <SeekBar
      time={time}
      duration={duration}
      buffered={buffered}
      disabled={duration <= 0}
      onSeek={(value) => { seekTo(player, value); setTime(value); reveal(); }}
      onFocusChange={(focused) => { seekFocused.current = focused; }}
      onScrubChange={setScrubbing}
      onPress={toggle}
    />
  );

  // TV keeps every control in one bottom bar: the progress bar, then a row of buttons. Up and down move between them.
  if (Platform.isTV) {
    return (
      <View style={StyleSheet.absoluteFill}>
        {layer}
        <LinearGradient pointerEvents="none" colors={["transparent", "rgba(0,0,0,0.6)", "rgba(0,0,0,0.92)"]} locations={[0, 0.45, 1]} style={[styles.shade, styles.tvShade]} />
        {disabled || status ? null : (
          <View pointerEvents="box-none" style={safeArea}>
          <View style={styles.tvBar}>
            {heading ? (
              <View style={styles.tvHeading}>
                {heading.logoUrl ? (
                  <Image source={heading.logoUrl} alt={heading.title} accessibilityLabel={heading.title} style={styles.tvLogo} contentFit="contain" contentPosition="left center" />
                ) : (
                  <Text accessibilityRole="header" numberOfLines={1} style={styles.tvTitle}>{heading.title}</Text>
                )}
                {heading.subtitle ? <Text numberOfLines={1} style={styles.tvSubtitle}>{heading.subtitle}</Text> : null}
              </View>
            ) : null}
            <TVFocusGuideView trapFocusLeft trapFocusRight>{seekBar}</TVFocusGuideView>
            <View style={styles.tvRow}>
              <View style={styles.tvGroup}>
                <IconButton buttonRef={playButton} preferredFocus label={playing ? t("pause") : t("play")} onPress={toggle} busy={buffering}>
                  {(ink) => <Ionicons name={playing ? "pause" : "play"} size={26} color={ink} />}
                </IconButton>
                <IconButton label={t("back10")} onPress={() => skip(false)}>{(ink) => <SkipIcon color={ink} />}</IconButton>
                <IconButton label={t("forward10")} onPress={() => skip(true)}>{(ink) => <SkipIcon forward color={ink} />}</IconButton>
              </View>
              {episodeButtons ? <View style={styles.tvGroup}>{episodeButtons}</View> : null}
              <View style={styles.tvGroup}>
                <IconButton label={t("cropBars")} selected={crop} onPress={onCrop}>{(ink) => <Feather name="crop" size={22} color={ink} />}</IconButton>
                <IconButton label={t("pictureInPicture")} onPress={onPip}>{(ink) => <PipIcon color={ink} size={22} />}</IconButton>
                {toolbar}
              </View>
            </View>
          </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {layer}
      <Pressable accessibilityElementsHidden importantForAccessibility="no" onPress={onSurfacePress} style={StyleSheet.absoluteFill} />
      <LinearGradient pointerEvents="none" colors={["rgba(0,0,0,0.6)", "transparent"]} style={[styles.shade, styles.shadeTop]} />
      <LinearGradient pointerEvents="none" colors={["transparent", "rgba(0,0,0,0.8)"]} style={[styles.shade, episodeButtons ? styles.shadeBottomTall : styles.shadeBottom]} />
      <View pointerEvents="box-none" style={safeArea}>
      <View pointerEvents="box-none" style={[styles.toolbar, leading ? styles.toolbarSplit : null]}>
        {leading}
        <ControlGroup>
          <IconButton label={t("cropBars")} selected={crop} disabled={disabled} onPress={onCrop}><Feather name="crop" size={16} color="#fff" /></IconButton>
          <IconButton label={t("pictureInPicture")} disabled={disabled} onPress={onPip}><PipIcon /></IconButton>
          {onFullscreen ? <IconButton label={t("enterFullscreen")} disabled={disabled} onPress={onFullscreen}><Feather name="maximize" size={16} color="#fff" /></IconButton> : null}
          {toolbar}
        </ControlGroup>
      </View>
      {disabled || status ? null : (
        <View pointerEvents="box-none" style={styles.center}>
          <IconButton label={t("back10")} onPress={() => skip(false)} round><SkipIcon /></IconButton>
          <IconButton label={playing ? t("pause") : t("play")} onPress={toggle} round large busy={buffering}>
            <Ionicons name={playing ? "pause" : "play"} size={24} color="#fff" />
          </IconButton>
          <IconButton label={t("forward10")} onPress={() => skip(true)} round><SkipIcon forward /></IconButton>
        </View>
      )}
      {/* Episode buttons stay when the stream fails, so another episode is one tap away. */}
      {disabled && !episodeButtons ? null : (
        <View pointerEvents="box-none" style={styles.bottom}>
          {disabled ? null : seekBar}
          {episodeButtons ? <View pointerEvents="box-none" style={styles.phoneEpisodes}>{episodeButtons}</View> : null}
        </View>
      )}
      </View>
    </View>
  );
}

function TVRemoteEvents({onEvent,onBack}:{onEvent:(event:HWEvent)=>void;onBack:()=>boolean}) {
  const active = useRef(false);
  useFocusEffect(useCallback(() => {
    active.current = true;
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => { active.current = false; subscription.remove(); };
  }, [onBack]));
  useTVEventHandler(event => { if (active.current) onEvent(event); });
  return null;
}

/** The web toolbar pill: dark glass with a thin border. */
function ControlGroup({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

/** The web skip icon: a circular arrow with the step inside. */
function SkipIcon({ forward, color = "#fff" }: { forward?: boolean; color?: string }) {
  return (
    <View>
      <Feather name={forward ? "rotate-cw" : "rotate-ccw"} size={24} color={color} />
      <View pointerEvents="none" style={styles.skipLabel}><Text style={[styles.skipText, { color }]}>{SEEK_STEP}</Text></View>
    </View>
  );
}

// Feather has no picture-in-picture glyph; this one matches the web icon.
function PipIcon({ color = "#fff", size = 18 }: { color?: string; size?: number }) {
  return <MaterialCommunityIcons name="picture-in-picture-bottom-right-outline" size={size} color={color} />;
}

/** A labeled control, such as Quality or Episodes. On TV it shares the icon buttons' focus treatment. */
export function ControlPill({ label, accessibilityLabel, icon, iconAfter, onPress, buttonRef, expanded, disabled }: {
  label: string;
  accessibilityLabel?: string;
  icon?: (ink: string) => ReactNode;
  iconAfter?: (ink: string) => ReactNode;
  onPress: () => void;
  buttonRef?: React.Ref<View>;
  expanded?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      ref={buttonRef}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled, expanded }}
      disabled={disabled}
      onPress={onPress}
      focusStyle={Platform.isTV ? styles.tvFocused : undefined}
      style={({ pressed }) => [Platform.isTV ? styles.tvPill : styles.pill, pressed && styles.pressed, disabled && styles.disabled]}
    >
      {({ focused }) => {
        const ink = Platform.isTV && focused ? TV_INK : "#fff";
        return <>{icon?.(ink)}<Text style={[Platform.isTV ? styles.tvPillText : styles.pillText, { color: ink }]}>{label}</Text>{iconAfter?.(ink)}</>;
      }}
    </Pressable>
  );
}

/** The web loading ring: a faint track with an accent arc. */
function Spinner() {
  const reduced = useReducedMotion();
  const [spin] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [reduced, spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return <Animated.View accessibilityElementsHidden importantForAccessibility="no" style={[styles.spinner, { transform: [{ rotate }] }]} />;
}

export function IconButton({ label, children, onPress, selected, disabled, round, large, busy, buttonRef, preferredFocus, expanded }: {
  label: string;
  /** A function receives the icon color, which turns dark while a TV button has focus. */
  children: ReactNode | ((ink: string) => ReactNode);
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  round?: boolean;
  large?: boolean;
  busy?: boolean;
  expanded?: boolean;
  buttonRef?: React.Ref<View>;
  preferredFocus?: boolean;
}) {
  return (
    <Pressable
      ref={buttonRef}
      hasTVPreferredFocus={preferredFocus}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected, busy, expanded }}
      disabled={disabled}
      onPress={onPress}
      focusStyle={Platform.isTV ? styles.tvFocused : undefined}
      style={({ pressed }) => [styles.button, Platform.isTV && styles.tvButton, round && styles.round, large && styles.large, selected && (Platform.isTV ? styles.tvSelected : styles.selected), pressed && styles.pressed, disabled && styles.disabled]}
    >
      {({ focused }) => typeof children === "function" ? children(Platform.isTV && focused ? TV_INK : "#fff") : children}
    </Pressable>
  );
}

function SeekBar({ time, duration, buffered, disabled, onSeek, onFocusChange, onPress, onScrubChange }: {
  time: number;
  duration: number;
  buffered: number;
  disabled?: boolean;
  onSeek: (seconds: number) => void;
  /** TV only: the focused bar takes left and right from the remote. */
  onFocusChange?: (focused: boolean) => void;
  /** TV only: select on the bar. */
  onPress?: () => void;
  /** Touch only: true while a drag is in progress. */
  onScrubChange?: (active: boolean) => void;
}) {
  const { t } = useLocale();
  const [width, setWidth] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const at = (event: GestureResponderEvent) => width > 0 ? Math.min(1, Math.max(0, event.nativeEvent.locationX / width)) * duration : 0;
  const position = scrub ?? time;
  const progress = duration > 0 ? Math.min(1, position / duration) : 0;
  const loaded = duration > 0 ? Math.min(1, Math.max(0, buffered) / duration) : 0;
  const step = (forward: boolean) => onSeek(Math.min(duration, Math.max(0, time + (forward ? SEEK_STEP : -SEEK_STEP))));
  const rail = (
    <View pointerEvents="none" style={[styles.rail, Platform.isTV && styles.tvRail, (scrub !== null || focused) && styles.railActive]}>
      <View style={[styles.buffered, { width: `${loaded * 100}%` }]} />
      <View style={[styles.fill, { width: `${progress * 100}%` }]} />
    </View>
  );

  if (Platform.isTV) {
    const focusChange = (value: boolean) => { setFocused(value); onFocusChange?.(value); };
    return (
      <Pressable
        accessibilityRole="adjustable"
        accessibilityLabel={t("seek")}
        accessibilityValue={{ text: `${formatTime(position)} / ${formatTime(duration)}` }}
        disabled={disabled}
        onPress={onPress}
        onFocus={() => focusChange(true)}
        onBlur={() => focusChange(false)}
        focusStyle={styles.tvSeekFocused}
        style={[styles.seekRow, styles.tvSeek]}
      >
        <Text style={[styles.time, styles.timeStart, !focused && styles.tvTimeIdle]}>{formatTime(position)}</Text>
        <View style={styles.track}>
          {rail}
          {focused ? <View pointerEvents="none" style={[styles.thumb, styles.tvThumb, { left: `${progress * 100}%` }]} /> : null}
        </View>
        <Text style={[styles.time, !focused && styles.tvTimeIdle]}>{formatTime(duration)}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.seekRow}>
      <Text style={[styles.time, styles.timeStart]}>{formatTime(position)}</Text>
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
        onResponderGrant={(event) => { setScrub(at(event)); onScrubChange?.(true); }}
        onResponderMove={(event) => setScrub(at(event))}
        onResponderRelease={(event) => { onSeek(at(event)); setScrub(null); onScrubChange?.(false); }}
        onResponderTerminate={() => { setScrub(null); onScrubChange?.(false); }}
        hitSlop={{ top: 12, bottom: 12 }}
        style={styles.track}
      >
        {rail}
        {scrub !== null ? (
          <>
            <View pointerEvents="none" style={[styles.thumb, { left: `${progress * 100}%` }]} />
            <View pointerEvents="none" style={[styles.bubbleAnchor, { left: `${progress * 100}%` }]}>
              <View style={styles.bubble}><Text style={styles.bubbleText}>{formatTime(scrub)}</Text></View>
            </View>
          </>
        ) : null}
      </View>
      <Text style={styles.time}>{formatTime(duration)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shade: { position: "absolute", left: 0, right: 0 },
  shadeTop: { top: 0, height: 80 },
  shadeBottom: { bottom: 0, height: 96 },
  shadeBottomTall: { bottom: 0, height: 150 },
  shadeHidden: { bottom: 0, height: "55%" },
  toolbar: { position: "absolute", top: 8, right: 8, left: 8, alignItems: "flex-end" },
  toolbarSplit: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  group: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.75)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", borderRadius: 999, padding: 4 },
  center: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 32 },
  button: { width: 44, height: 44, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  tvButton: { width: 56, height: 56, backgroundColor: "rgba(255,255,255,0.12)" },
  tvSelected: { backgroundColor: colors.accent },
  // Replaces the shared outline ring: the inverted fill is the focus indicator.
  tvFocused: { backgroundColor: "#fff", transform: [{ scale: 1.1 }], boxShadow: "0 6px 20px rgba(0,0,0,0.5)" },
  tvPill: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 56, borderRadius: 999, paddingHorizontal: 22, backgroundColor: "rgba(255,255,255,0.12)" },
  tvPillText: { fontSize: 17, fontFamily: fonts.bodySemiBold, fontVariant: ["tabular-nums"] },
  round: { backgroundColor: "rgba(0,0,0,0.4)" },
  large: { width: 56, height: 56, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(0,0,0,0.6)" },
  selected: { backgroundColor: "rgba(255,255,255,0.2)" },
  disabled: { opacity: 0.5 },
  pressed: { backgroundColor: "rgba(255,255,255,0.2)" },
  skipLabel: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", paddingTop: 1 },
  skipText: { color: "#fff", fontSize: 8, fontFamily: fonts.bodyBold, fontVariant: ["tabular-nums"] },
  status: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 24 },
  statusDim: { backgroundColor: "rgba(0,0,0,0.6)" },
  statusText: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontFamily: fonts.bodyMedium, textAlign: "center" },
  spinner: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: "rgba(255,255,255,0.15)", borderTopColor: colors.accent },
  captions: { justifyContent: "flex-end", alignItems: "center", paddingHorizontal: 24 },
  seekHint: { position: "absolute", top: "50%", width: 64, height: 64, marginTop: -32, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.6)" },
  seekHintBack: { left: "12%" },
  seekHintForward: { right: "12%" },
  bottom: { position: "absolute", left: 12, right: 12, bottom: 8 },
  phoneEpisodes: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingTop: 4 },
  pill: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 40, borderRadius: 999, paddingHorizontal: 14, backgroundColor: "rgba(0,0,0,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  pillText: { fontSize: 13, fontFamily: fonts.bodySemiBold },
  tvShade: { bottom: 0, height: "75%" },
  tvBar: { position: "absolute", left: screenPadding, right: screenPadding, bottom: 24, gap: 14 },
  tvHeading: { gap: 6, paddingHorizontal: 12, marginBottom: 2 },
  tvLogo: { width: 260, height: 64 },
  tvTitle: { color: "#fff", fontSize: 30, fontFamily: fonts.heading, letterSpacing: -0.5 },
  tvSubtitle: { color: "rgba(255,255,255,0.75)", fontSize: 17, fontFamily: fonts.bodyMedium, fontVariant: ["tabular-nums"] },
  tvRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tvGroup: { flexDirection: "row", alignItems: "center", gap: 12 },
  tvSeek: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  tvSeekFocused: { backgroundColor: "rgba(255,255,255,0.08)" },
  tvRail: { height: 6, borderRadius: 3 },
  tvThumb: { width: 20, height: 20, marginLeft: -10, borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.5)" },
  tvTimeIdle: { color: "rgba(255,255,255,0.7)" },
  seekRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  track: { flex: 1, height: 24, justifyContent: "center" },
  rail: { height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", overflow: "hidden" },
  railActive: { transform: [{ scaleY: 1.5 }] },
  buffered: { position: "absolute", top: 0, bottom: 0, left: 0, backgroundColor: "rgba(255,255,255,0.3)" },
  fill: { position: "absolute", top: 0, bottom: 0, left: 0, backgroundColor: colors.accent },
  thumb: { position: "absolute", width: 12, height: 12, marginLeft: -6, borderRadius: 6, backgroundColor: "#fff" },
  bubbleAnchor: { position: "absolute", bottom: "100%", width: 96, marginLeft: -48, alignItems: "center", marginBottom: 8 },
  bubble: { borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(0,0,0,0.75)", paddingHorizontal: 8, paddingVertical: 4 },
  bubbleText: { color: "#fff", fontSize: 12, fontFamily: fonts.bodyMedium, fontVariant: ["tabular-nums"] },
  time: { minWidth: Platform.isTV ? 64 : 40, color: "#fff", fontSize: Platform.isTV ? 16 : 12, fontFamily: fonts.bodyMedium, fontVariant: ["tabular-nums"] },
  timeStart: { textAlign: "right" },
});
