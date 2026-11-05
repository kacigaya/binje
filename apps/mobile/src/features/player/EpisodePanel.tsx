import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { Platform, ScrollView, StyleSheet, Text, TVFocusGuideView, View } from "react-native";
import { TVPressable as Pressable } from "../../components/TVPressable";
import { useLocale } from "../../providers/LocaleProvider";
import { colors, fonts, screenPadding } from "../../theme";
import type { MobileEpisode, MobileSeason } from "../../types/api";

// Only TV has focus guides; react-native-web has no TVFocusGuideView, and touch needs no trap.
const FocusTrap = Platform.isTV ? TVFocusGuideView : View;

const INK = "#0a0a0b";

const CARD_WIDTH = Platform.isTV ? 240 : 200;

/**
 * The episode picker. It replaces the player controls at the bottom of the screen.
 * On TV the D-pad stays inside it until Back closes it; phones also get a close button.
 * Browsing another season does not change playback; selecting an episode does.
 */
export function EpisodePanel({ title, seasons, season, onSeasonChange, episodes, loading, failed, onRetry, playingSeason, playingEpisode, onSelect, onClose }: {
  title: string;
  seasons: MobileSeason[];
  /** The season shown in the panel. */
  season: number;
  onSeasonChange: (season: number) => void;
  episodes: MobileEpisode[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  playingSeason: number;
  playingEpisode: number;
  onSelect: (episode: number) => void;
  onClose?: () => void;
}) {
  const { t } = useLocale();
  return (
    <View style={styles.sheet}>
      <LinearGradient pointerEvents="none" colors={["transparent", "rgba(0,0,0,0.88)", "rgba(0,0,0,0.96)"]} locations={[0, 0.3, 1]} style={StyleSheet.absoluteFill} />
      <FocusTrap trapFocusUp trapFocusDown trapFocusLeft trapFocusRight style={styles.content}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.heading}>{t("episodes")}</Text>
          <Text numberOfLines={1} style={styles.show}>{title}</Text>
          {onClose && !Platform.isTV ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t("close")} hitSlop={8} onPress={onClose} style={({ pressed }) => [styles.close, pressed && styles.closePressed]}>
              <Feather name="x" size={18} color={colors.text} />
            </Pressable>
          ) : null}
        </View>
        {seasons.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {seasons.map((item) => {
              const active = item.seasonNumber === season;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => onSeasonChange(item.seasonNumber)}
                  focusStyle={styles.chipFocused}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  {({ focused }) => <Text style={[styles.chipText, focused && { color: INK }]}>{item.name}</Text>}
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
        {loading ? (
          <View style={styles.cards}>
            {Array.from({ length: 4 }).map((_, index) => <View key={index} style={[styles.still, styles.skeleton]} />)}
          </View>
        ) : failed ? (
          <View style={styles.message}>
            <Text accessibilityRole="alert" style={styles.messageText}>{t("errorBody")}</Text>
            <Pressable hasTVPreferredFocus accessibilityRole="button" onPress={onRetry} focusStyle={styles.chipFocused} style={styles.chip}>
              {({ focused }) => <Text style={[styles.chipText, focused && { color: INK }]}>{t("retry")}</Text>}
            </Pressable>
          </View>
        ) : !episodes.length ? (
          <Text style={[styles.messageText, styles.padded]}>{t("noEpisodes")}</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
            {episodes.map((item) => {
              const playing = season === playingSeason && item.episodeNumber === playingEpisode;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.episodeNumber}. ${item.name}`}
                  accessibilityState={{ selected: playing }}
                  hasTVPreferredFocus={playing}
                  focusStyle={styles.cardFocused}
                  onPress={() => onSelect(item.episodeNumber)}
                  style={styles.card}
                >
                  {({ focused }) => <>
                    {/* The ring sits on the still only, so the title stays readable under it. */}
                    <View style={[styles.still, focused && styles.stillFocused]}>
                      {item.stillUrl ? <Image source={item.stillUrl} alt="" style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                      {playing ? <View style={styles.badge}><Text style={styles.badgeText}>{t("watching")}</Text></View> : null}
                      {playing ? <View style={styles.activeBar} /> : null}
                    </View>
                    <View style={styles.cardText}>
                      <Text numberOfLines={1} style={[styles.cardTitle, !focused && styles.cardTitleIdle]}>{item.episodeNumber}. {item.name}</Text>
                      {item.runtime ? <Text style={styles.cardMeta}>{item.runtime} {t("minutes")}</Text> : null}
                    </View>
                  </>}
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </FocusTrap>
    </View>
  );
}

const styles = StyleSheet.create({
  // The gradient starts above the content so the sheet fades into the video.
  sheet: { paddingTop: Platform.isTV ? 72 : 32 },
  content: { gap: Platform.isTV ? 14 : 8, paddingBottom: Platform.isTV ? 28 : 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: screenPadding },
  heading: { color: colors.text, fontSize: Platform.isTV ? 26 : 20, fontFamily: fonts.heading, letterSpacing: -0.3 },
  show: { flex: 1, color: "rgba(255,255,255,0.6)", fontSize: Platform.isTV ? 17 : 14, fontFamily: fonts.bodyMedium },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)" },
  closePressed: { backgroundColor: "rgba(255,255,255,0.2)" },
  chips: { gap: 10, paddingVertical: 6, paddingHorizontal: screenPadding },
  chip: { minHeight: Platform.isTV ? 44 : 34, borderRadius: 999, paddingHorizontal: Platform.isTV ? 20 : 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)" },
  chipActive: { backgroundColor: colors.accent },
  chipFocused: { backgroundColor: "#fff", transform: [{ scale: 1.06 }] },
  chipText: { color: colors.text, fontSize: Platform.isTV ? 16 : 13, fontFamily: fonts.bodySemiBold },
  // Room for the focused TV card to grow 8% without clipping: about 10 pt on each side of a 240 pt card.
  cards: { flexDirection: "row", gap: Platform.isTV ? 20 : 12, paddingVertical: Platform.isTV ? 12 : 4, paddingHorizontal: screenPadding },
  card: { width: CARD_WIDTH, gap: Platform.isTV ? 10 : 6, borderRadius: 12 },
  cardFocused: { transform: [{ scale: 1.08 }] },
  stillFocused: { borderWidth: 3, borderColor: "#fff", boxShadow: "0 10px 30px rgba(0,0,0,0.6)" },
  still: { width: CARD_WIDTH, height: CARD_WIDTH * 9 / 16, borderRadius: 12, overflow: "hidden", backgroundColor: colors.surfaceAlt },
  skeleton: { backgroundColor: "rgba(255,255,255,0.08)" },
  badge: { position: "absolute", top: 8, left: 8, borderRadius: 6, backgroundColor: colors.accent, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: "#fff", fontSize: 13, fontFamily: fonts.bodySemiBold },
  activeBar: { position: "absolute", left: 0, right: 0, bottom: 0, height: 4, backgroundColor: colors.accent },
  cardText: { gap: 2, paddingHorizontal: 2 },
  cardTitle: { color: "#fff", fontSize: Platform.isTV ? 16 : 13, fontFamily: fonts.bodySemiBold },
  cardTitleIdle: { color: "rgba(255,255,255,0.8)" },
  cardMeta: { color: "rgba(255,255,255,0.6)", fontSize: Platform.isTV ? 14 : 12, fontFamily: fonts.body, fontVariant: ["tabular-nums"] },
  message: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: screenPadding },
  messageText: { color: colors.muted, fontSize: 16, fontFamily: fonts.body },
  padded: { paddingHorizontal: screenPadding },
});
