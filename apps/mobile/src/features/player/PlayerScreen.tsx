import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { getMediaDetails, getSeason } from "../../api/media";
import { BackButton } from "../../components/BackButton";
import { RtRating, TmdbRating } from "../../components/Badges";
import { useLocale } from "../../providers/LocaleProvider";
import { upsertPlayHistory, updatePlayHistoryProgress } from "../../storage/playHistory";
import { colors, fonts, spacing } from "../../theme";
import { createProgressWriter } from "./progressWriter";
import { proxiedHlsUrl, resolveStream, type AudioVariant } from "./resolveStream";
import type { MobileMediaType, StreamResponse } from "../../types/api";

export function PlayerScreen({
  type,
  id,
  initialSeason,
  initialEpisode,
}: {
  type: MobileMediaType;
  id: number;
  initialSeason?: number;
  initialEpisode?: number;
}) {
  const { locale, t } = useLocale();
  const [variant, setVariant] = useState<AudioVariant>("vo");
  const [season, setSeason] = useState(initialSeason ?? 1);
  const [episode, setEpisode] = useState(initialEpisode ?? 1);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [stream, setStream] = useState<StreamResponse | null>(null);
  const [qualityHeight, setQualityHeight] = useState<number | null>(null);
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);
  const [seasonPickerOpen, setSeasonPickerOpen] = useState(false);
  const details = useQuery({
    queryKey: ["details", type, id, locale],
    queryFn: ({ signal }) => getMediaDetails(type, id, locale, signal),
    enabled: Number.isInteger(id) && id > 0,
  });
  const episodes = useQuery({
    queryKey: ["season", id, season, locale],
    queryFn: ({ signal }) => getSeason(id, season, locale, signal),
    enabled: type === "tv" && Number.isInteger(id) && id > 0,
  });

  const player = useVideoPlayer(null, (instance) => {
    instance.loop = false;
    instance.timeUpdateEventInterval = 1;
    instance.keepScreenOnWhilePlaying = true;
  });

  const progressWriter = useMemo(
    () =>
      createProgressWriter((positionSeconds, durationSeconds) =>
        updatePlayHistoryProgress({ type, id, season, episode, positionSeconds, durationSeconds }),
      ),
    [episode, id, season, type],
  );

  useEffect(() => {
    const subscription = player.addListener("timeUpdate", ({ currentTime }) => {
      void progressWriter.update(currentTime, player.duration);
    });
    return () => {
      subscription.remove();
      void progressWriter.flush();
    };
  }, [player, progressWriter]);

  useEffect(() => {
    const media = details.data;
    if (!media) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setResolving(true);
        setStreamError(null);
        setStream(null);
      }
    });
    void upsertPlayHistory({
      type,
      id,
      title: media.title,
      poster_path: media.posterUrl,
      backdrop_path: media.backdropUrl,
      date: media.date,
      vote_average: media.rating,
      ...(type === "tv" ? { season, episode } : {}),
    });
    resolveStream(
      {
        type,
        id,
        title: media.stream.originalTitle || media.title,
        year: media.stream.year || media.date.slice(0, 4),
        imdbId: media.stream.imdbId,
        ...(type === "tv" ? { season, episode } : {}),
      },
      variant,
    )
      .then(async (result) => {
        if (cancelled) return;
        setStream(result);
        setQualityHeight(null);
        await player.replaceAsync({ uri: proxiedHlsUrl(result.url), contentType: "hls" });
        if (!cancelled) player.play();
      })
      .catch((error: unknown) => {
        if (!cancelled) setStreamError(error instanceof Error ? error.message : "Stream unavailable.");
      })
      .finally(() => {
        if (!cancelled) setResolving(false);
      });
    return () => {
      cancelled = true;
      player.pause();
      void progressWriter.flush();
    };
  }, [details.data, episode, id, player, progressWriter, season, type, variant]);

  const qualityHeights = [...new Set((stream?.sources ?? []).map((source) => source.height))].sort((a, b) => b - a);

  async function changeQuality(height: number | null) {
    setQualityMenuOpen(false);
    if (!stream || height === qualityHeight) return;
    const file = height == null ? stream.url : stream.sources?.find((source) => source.height === height)?.file;
    if (!file) return;
    setQualityHeight(height);
    const position = player.currentTime;
    await player.replaceAsync({ uri: proxiedHlsUrl(file), contentType: "hls" });
    if (position > 0) player.seekBy(position);
    player.play();
  }

  const seasonList = (details.data?.seasons ?? []).filter((item) => item.seasonNumber > 0);
  const currentSeason = seasonList.find((item) => item.seasonNumber === season);
  const maxEpisodes = currentSeason?.episodeCount ?? 1;
  const hasPrev = episode > 1 || seasonList.some((item) => item.seasonNumber === season - 1);
  const hasNext = episode < maxEpisodes || seasonList.some((item) => item.seasonNumber === season + 1);
  const seasonName = currentSeason?.name ?? `${t("season")} ${season}`;

  function selectEpisode(nextSeason: number, nextEpisode: number) {
    setSeason(nextSeason);
    setEpisode(nextEpisode);
  }

  function prevEpisode() {
    if (episode > 1) {
      selectEpisode(season, episode - 1);
    } else {
      const target = seasonList.find((item) => item.seasonNumber === season - 1);
      if (target) selectEpisode(target.seasonNumber, target.episodeCount);
    }
  }

  function nextEpisode() {
    if (episode < maxEpisodes) {
      selectEpisode(season, episode + 1);
    } else {
      const target = seasonList.find((item) => item.seasonNumber === season + 1);
      if (target) selectEpisode(target.seasonNumber, 1);
    }
  }

  if (details.isLoading) {
    return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;
  }
  if (!details.data || details.isError) {
    return <View style={styles.center}><Text style={styles.error}>Unable to load this title.</Text></View>;
  }

  return (
    <View style={styles.screen}>
    <BackButton />
    <ScrollView style={styles.fill} contentContainerStyle={styles.content}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={details.data.title}
        onPress={() => router.push(`/${type}/${id}` as never)}
        style={({ pressed }) => [styles.titleLink, pressed && { opacity: 0.7 }]}
      >
        {details.data.logoUrl ? (
          <Image
            source={details.data.logoUrl}
            alt={details.data.title}
            style={styles.titleLogo}
            contentFit="contain"
            contentPosition="left center"
            transition={200}
          />
        ) : (
          <Text style={styles.title}>{details.data.title}</Text>
        )}
      </Pressable>
      {details.data.genres.length ? (
        <View style={styles.genres}>
          {details.data.genres.map((genre) => (
            <View key={genre.id} style={styles.genre}><Text style={styles.genreText}>{genre.name}</Text></View>
          ))}
        </View>
      ) : null}
      <View style={styles.metaRow}>
        <TmdbRating rating={details.data.rating.toFixed(1)} />
        {details.data.rottenTomatoesScore != null ? <RtRating score={details.data.rottenTomatoesScore} /> : null}
        {details.data.contentRating ? <Text style={styles.rated}>{details.data.contentRating}</Text> : null}
        {details.data.runtime ? (
          <Text style={styles.metaText}>
            {Math.floor(details.data.runtime / 60) > 0 ? `${Math.floor(details.data.runtime / 60)}h ` : ""}{details.data.runtime % 60}m
          </Text>
        ) : null}
        {details.data.date ? <Text style={styles.metaText}>{details.data.date.slice(0, 4)}</Text> : null}
      </View>
      {details.data.overview ? (
        <Text numberOfLines={4} style={styles.overview}>{details.data.overview}</Text>
      ) : null}
      <View style={styles.videoShell}>
        <VideoView
          player={player}
          style={styles.video}
          nativeControls
          contentFit="contain"
          allowsPictureInPicture
          fullscreenOptions={{ enable: true }}
        />
        {resolving ? <View style={styles.overlay}><ActivityIndicator color="#fff" size="large" /></View> : null}
        {/* VO/VF + quality selector floating on the player, like the web build */}
        <View style={styles.playerControls}>
          <View style={styles.playerPillGroup}>
            {(["vo", "vf"] as const).map((item) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: variant === item }}
                key={item}
                onPress={() => setVariant(item)}
                style={[styles.playerPill, variant === item && styles.playerPillActive]}
              >
                <Text style={[styles.playerPillText, variant !== item && styles.playerPillTextDim]}>{item.toUpperCase()}</Text>
              </Pressable>
            ))}
            {qualityHeights.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t("quality")}: ${qualityHeight == null ? t("auto") : `${qualityHeight}p`}`}
                onPress={() => setQualityMenuOpen((open) => !open)}
                style={styles.playerPill}
              >
                <Text style={styles.playerPillText}>{qualityHeight == null ? t("auto") : `${qualityHeight}p`}</Text>
                <Ionicons name={qualityMenuOpen ? "chevron-up" : "chevron-down"} size={13} color={colors.text} />
              </Pressable>
            ) : null}
          </View>
          {qualityMenuOpen ? (
            <View style={styles.qualityMenu}>
              {[null, ...qualityHeights].map((height) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: qualityHeight === height }}
                  key={height ?? "auto"}
                  onPress={() => void changeQuality(height)}
                  style={styles.qualityItem}
                >
                  <Text style={[styles.playerPillText, qualityHeight === height && styles.qualityItemActive]}>
                    {height == null ? t("auto") : `${height}p`}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </View>
      {streamError ? <Text style={styles.error}>{streamError}</Text> : null}
      {type === "tv" ? (
        <>
          <View style={styles.controlsRow}>
            <Text style={styles.controlLabel}>{t("season").toUpperCase()}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: seasonPickerOpen }}
              onPress={() => setSeasonPickerOpen((open) => !open)}
              style={styles.seasonSelect}
            >
              <Text style={styles.seasonSelectText}>{seasonName}</Text>
              <Ionicons name={seasonPickerOpen ? "chevron-up" : "chevron-down"} size={14} color={colors.text} />
            </Pressable>
          </View>
          {seasonPickerOpen ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {seasonList.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: season === item.seasonNumber }}
                  onPress={() => { setSeasonPickerOpen(false); selectEpisode(item.seasonNumber, 1); }}
                  style={[styles.seasonOption, season === item.seasonNumber && styles.seasonOptionActive]}
                >
                  <Text style={styles.seasonSelectText}>{item.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          <View style={styles.nowPlayingRow}>
            <View style={styles.fillMin}>
              <Text style={styles.controlLabel}>{t("nowWatching").toUpperCase()}</Text>
              <Text numberOfLines={1} style={styles.nowPlayingText}>{seasonName}, {t("episode")} {episode}</Text>
            </View>
          </View>
          <View style={styles.navRow}>
            <Pressable
              accessibilityRole="button"
              disabled={!hasPrev}
              onPress={prevEpisode}
              style={[styles.navButton, !hasPrev && styles.navButtonDisabled]}
            >
              <Ionicons name="chevron-back" size={16} color={colors.text} />
              <Text style={styles.navButtonText}>{t("previous")}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!hasNext}
              onPress={nextEpisode}
              style={[styles.navButton, !hasNext && styles.navButtonDisabled]}
            >
              <Text style={styles.navButtonText}>{t("next")}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.text} />
            </Pressable>
          </View>
          <Text style={styles.heading}>{t("episodes")}</Text>
          {episodes.isLoading ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.episodeRow}>
              {Array.from({ length: 4 }).map((_, index) => (
                <View key={index} style={[styles.episodeCard, styles.episodeSkeleton]} />
              ))}
            </ScrollView>
          ) : !episodes.data?.episodes.length ? (
            <Text style={styles.metaText}>{t("noEpisodes")}</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.episodeRow}>
              {episodes.data.episodes.map((item) => {
                const isActive = item.episodeNumber === episode;
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.episodeNumber}. ${item.name}`}
                    accessibilityState={{ selected: isActive }}
                    onPress={() => setEpisode(item.episodeNumber)}
                    style={[styles.episodeCard, isActive && styles.episodeCardActive]}
                  >
                    {item.stillUrl ? (
                      <Image source={item.stillUrl} alt={item.name} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                    ) : (
                      <View style={styles.episodeNoPreview}><Text style={styles.metaText}>{t("noPreview")}</Text></View>
                    )}
                    <LinearGradient
                      colors={["transparent", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.95)"]}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.episodeContent}>
                      <View style={styles.episodeTitleRow}>
                        {isActive ? (
                          <View style={styles.watchingBadge}><Text style={styles.watchingBadgeText}>{t("watching").toUpperCase()}</Text></View>
                        ) : null}
                        <Text numberOfLines={2} style={styles.episodeTitle}>{item.episodeNumber}. {item.name}</Text>
                      </View>
                      {item.runtime ? (
                        <View style={styles.episodeMetaRow}>
                          <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.6)" />
                          <Text style={styles.episodeRuntime}>{item.runtime}m</Text>
                        </View>
                      ) : null}
                      {item.overview ? (
                        <Text numberOfLines={2} style={styles.episodeOverview}>{item.overview}</Text>
                      ) : null}
                    </View>
                    {isActive ? <View style={styles.episodeActiveBar} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </>
      ) : null}
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  fillMin: { flexShrink: 1, minWidth: 0 },
  content: { padding: spacing.md, paddingTop: 96, gap: spacing.md },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  title: { color: colors.text, fontSize: 26, fontFamily: fonts.heading, letterSpacing: -0.5 },
  titleLink: { alignSelf: "flex-start" },
  titleLogo: { width: 280, maxWidth: "100%", height: 84 },
  genres: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  genre: { borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  genreText: { color: "rgba(240,240,240,0.8)", fontSize: 12, fontFamily: fonts.body },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  metaText: { color: colors.muted, fontSize: 14, fontFamily: fonts.body },
  rated: { color: colors.accent, fontSize: 14, fontFamily: fonts.bodySemiBold },
  overview: { color: "rgba(240,240,240,0.7)", fontSize: 14, lineHeight: 21, fontFamily: fonts.body },
  videoShell: { aspectRatio: 16 / 9, backgroundColor: "#000", borderRadius: 12, overflow: "hidden" },
  video: { flex: 1 },
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", backgroundColor: "#0008" },
  playerControls: { position: "absolute", top: 8, right: 8, alignItems: "flex-end" },
  playerPillGroup: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "rgba(12,12,15,0.85)", borderRadius: 999, padding: 3 },
  playerPill: { flexDirection: "row", alignItems: "center", gap: 3, minHeight: 30, borderRadius: 999, paddingHorizontal: 12, justifyContent: "center" },
  playerPillActive: { backgroundColor: colors.accent },
  playerPillText: { color: colors.text, fontSize: 13, fontFamily: fonts.bodySemiBold },
  playerPillTextDim: { color: "rgba(240,240,240,0.6)" },
  qualityMenu: { marginTop: 4, backgroundColor: "rgba(12,12,15,0.92)", borderRadius: 14, paddingVertical: 4, minWidth: 88 },
  qualityItem: { paddingHorizontal: 14, paddingVertical: 8, alignItems: "center" },
  qualityItemActive: { color: colors.accent },
  error: { color: colors.destructive, textAlign: "center", padding: spacing.md },
  row: { flexDirection: "row", gap: 10 },
  controlsRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  controlLabel: { color: colors.muted, fontSize: 11, fontFamily: fonts.bodySemiBold, letterSpacing: 1.8 },
  seasonSelect: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, borderRadius: 999, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: "rgba(255,255,255,0.05)", paddingHorizontal: 16 },
  seasonSelectText: { color: colors.text, fontSize: 14, fontFamily: fonts.bodyMedium },
  seasonOption: { minHeight: 40, borderRadius: 999, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  seasonOptionActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  nowPlayingRow: { flexDirection: "row", alignItems: "center" },
  nowPlayingText: { color: colors.text, fontSize: 15, fontFamily: fonts.heading, marginTop: 2 },
  navRow: { flexDirection: "row", gap: 8 },
  navButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, minHeight: 40, borderRadius: 999, borderWidth: 1, borderColor: colors.borderStrong, paddingHorizontal: 16 },
  navButtonDisabled: { opacity: 0.4 },
  navButtonText: { color: colors.text, fontSize: 14, fontFamily: fonts.bodyMedium },
  heading: { color: colors.text, fontSize: 19, fontFamily: fonts.heading, marginTop: 8 },
  episodeRow: { gap: 12, paddingVertical: 2 },
  episodeCard: { width: 280, aspectRatio: 16 / 9, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", backgroundColor: colors.surface },
  episodeCardActive: { borderWidth: 2, borderColor: "#fff" },
  episodeSkeleton: { borderWidth: 0, backgroundColor: "rgba(255,255,255,0.05)" },
  episodeNoPreview: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
  episodeContent: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 12, gap: 3 },
  episodeTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  watchingBadge: { backgroundColor: colors.accent, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  watchingBadgeText: { color: "#fff", fontSize: 9, fontFamily: fonts.bodyBold, letterSpacing: 0.8 },
  episodeTitle: { flexShrink: 1, color: "#fff", fontSize: 14, lineHeight: 18, fontFamily: fonts.bodySemiBold },
  episodeMetaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  episodeRuntime: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontFamily: fonts.body },
  episodeOverview: { color: "rgba(255,255,255,0.5)", fontSize: 11, lineHeight: 14, fontFamily: fonts.body },
  episodeActiveBar: { position: "absolute", left: 0, right: 0, bottom: 0, height: 4, backgroundColor: colors.accent },
});
