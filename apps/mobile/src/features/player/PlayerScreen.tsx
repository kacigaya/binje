import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useToast } from "../../providers/ToastProvider";
import { upsertPlayHistory, updatePlayHistoryProgress } from "../../storage/playHistory";
import { colors, fonts, spacing } from "../../theme";
import { createProgressWriter } from "./progressWriter";
import {
  DEFAULT_SOURCE,
  fetchAvailableSources,
  proxiedHlsUrl,
  resolveStream,
  SOURCE_LABELS,
  type PlaybackSource,
  type StreamMedia,
} from "./resolveStream";
import NativeCastControls from "./CastControls";
import type { MobileMediaType, StreamResponse } from "../../types/api";

// Episode changes keep this screen mounted, so per-episode source state
// carries the media key it belongs to and is ignored once that changes.
type Keyed<T> = { key: string; value: T };
function forMedia<T>(state: Keyed<T> | null, key: string): T | undefined {
  return state?.key === key ? state.value : undefined;
}

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
  const toast = useToast();
  const [season, setSeason] = useState(initialSeason ?? 1);
  const [episode, setEpisode] = useState(initialEpisode ?? 1);
  const [resolving, setResolving] = useState(false);
  // undefined while probing, null when the probe itself failed.
  const [available, setAvailable] = useState<Keyed<PlaybackSource[] | null> | null>(null);
  const [failed, setFailed] = useState<Keyed<PlaybackSource[]> | null>(null);
  const [picked, setPicked] = useState<Keyed<PlaybackSource> | null>(null);
  const [playing, setPlaying] = useState<Keyed<PlaybackSource> | null>(null);
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);
  const [stream, setStream] = useState<StreamResponse | null>(null);
  const [qualityHeight, setQualityHeight] = useState<number | null>(null);
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);
  const [seasonPickerOpen, setSeasonPickerOpen] = useState(false);
  const [casting, setCasting] = useState(false);
  const castingRef = useRef(false);
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

  const mediaKey = `${type}:${id}:${type === "tv" ? `${season}:${episode}` : "movie"}`;
  const streamMedia = useMemo<StreamMedia | null>(() => {
    const media = details.data;
    if (!media) return null;
    return {
      type,
      id,
      title: media.stream.originalTitle || media.title,
      year: media.stream.year || media.date.slice(0, 4),
      imdbId: media.stream.imdbId,
      ...(type === "tv" ? { season, episode } : {}),
    };
  }, [details.data, episode, id, season, type]);
  const availableList = forMedia(available, mediaKey);
  const failedList = forMedia(failed, mediaKey) ?? [];
  const usable = (source: PlaybackSource | undefined) => (source && !failedList.includes(source) ? source : undefined);
  const playingSource = usable(forMedia(playing, mediaKey));
  // A manual pick wins, then whatever already plays, then the first listed
  // source that has not failed here. A failure moves on to the next one.
  const source =
    usable(forMedia(picked, mediaKey)) ??
    playingSource ??
    (availableList ?? [DEFAULT_SOURCE]).find((item) => !failedList.includes(item)) ??
    null;
  const sourceOptions = [...(availableList ?? [])];
  if (playingSource && !sourceOptions.includes(playingSource)) sourceOptions.push(playingSource);
  const visibleSources = sourceOptions.filter((item) => !failedList.includes(item));
  const exhausted = source === null && availableList !== undefined;
  const streamError = exhausted ? t("streamUnavailable") : null;

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
  const handleCastingChange = useCallback((active: boolean) => {
    castingRef.current = active;
    setCasting(active);
  }, []);
  const handleRemoteProgress = useCallback(
    (positionSeconds: number, durationSeconds: number) => {
      void progressWriter.update(positionSeconds, durationSeconds);
    },
    [progressWriter],
  );
  const handleCastDisconnect = useCallback(
    (positionSeconds: number, resume: boolean) => {
      if (Number.isFinite(positionSeconds) && positionSeconds > 0) {
        player.seekBy(positionSeconds - player.currentTime);
      }
      if (resume) player.play();
    },
    [player],
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
    if (!streamMedia) return;
    let cancelled = false;
    fetchAvailableSources(streamMedia)
      .then((list) => {
        if (!cancelled) setAvailable({ key: mediaKey, value: list });
      })
      .catch(() => {
        if (!cancelled) setAvailable({ key: mediaKey, value: null });
      });
    return () => {
      cancelled = true;
    };
  }, [mediaKey, streamMedia]);

  useEffect(() => {
    if (exhausted) toast.show({ message: t("streamUnavailable") });
  }, [exhausted, t, toast]);

  useEffect(() => {
    const media = details.data;
    if (!media || !streamMedia || !source) return;
    let cancelled = false;
    const fail = () => {
      setFailed((previous) => {
        const list = forMedia(previous, mediaKey) ?? [];
        return { key: mediaKey, value: list.includes(source) ? list : [...list, source] };
      });
    };
    const subscription = player.addListener("statusChange", ({ status }) => {
      if (status === "error" && !cancelled) fail();
    });
    queueMicrotask(() => {
      if (!cancelled) {
        setResolving(true);
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
    resolveStream(streamMedia, source)
      .then(async (result) => {
        if (cancelled) return;
        setStream(result);
        setQualityHeight(null);
        await player.replaceAsync({ uri: proxiedHlsUrl(result.url), contentType: "hls" });
        if (cancelled) return;
        setPlaying({ key: mediaKey, value: source });
        if (!castingRef.current) player.play();
      })
      .catch(() => {
        if (!cancelled) fail();
      })
      .finally(() => {
        if (!cancelled) setResolving(false);
      });
    return () => {
      cancelled = true;
      subscription.remove();
      player.pause();
      void progressWriter.flush();
    };
  }, [details.data, episode, id, mediaKey, player, progressWriter, season, source, streamMedia, type]);

  const qualityHeights = [...new Set((stream?.sources ?? []).map((source) => source.height))].sort((a, b) => b - a);

  async function changeQuality(height: number | null) {
    setQualityMenuOpen(false);
    if (!stream || height === qualityHeight) return;
    const file = height == null ? stream.url : stream.sources?.find((source) => source.height === height)?.file;
    if (!file) return;
    setQualityHeight(height);
    const wasCasting = castingRef.current;
    const position = player.currentTime;
    await player.replaceAsync({ uri: proxiedHlsUrl(file), contentType: "hls" });
    if (position > 0) player.seekBy(position);
    if (!wasCasting) player.play();
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
          nativeControls={!casting}
          contentFit="contain"
          allowsPictureInPicture
          fullscreenOptions={{ enable: true }}
        />
        {resolving || (source === null && !exhausted) ? (
          <View style={styles.overlay}><ActivityIndicator color="#fff" size="large" /></View>
        ) : null}
        <View style={styles.playerControls}>
          <View style={styles.playerPillGroup}>
            <NativeCastControls
              player={player}
              mediaKey={mediaKey}
              source={stream
                ? qualityHeight == null
                  ? stream.url
                  : stream.sources?.find((item) => item.height === qualityHeight)?.file ?? stream.url
                : null}
              tracks={stream?.tracks ?? []}
              title={details.data.title}
              onCastingChange={handleCastingChange}
              onDisconnect={handleCastDisconnect}
              onRemoteProgress={handleRemoteProgress}
            />
            {source && visibleSources.includes(source) ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t("source")}: ${SOURCE_LABELS[source].label}`}
                accessibilityState={{ expanded: sourceMenuOpen }}
                onPress={() => {
                  setQualityMenuOpen(false);
                  setSourceMenuOpen((open) => !open);
                }}
                style={styles.playerPill}
              >
                <Text style={styles.playerPillText}>{SOURCE_LABELS[source].pill}</Text>
                <Ionicons name={sourceMenuOpen ? "chevron-up" : "chevron-down"} size={13} color={colors.text} />
              </Pressable>
            ) : null}
            {qualityHeights.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t("quality")}: ${qualityHeight == null ? t("auto") : `${qualityHeight}p`}`}
                onPress={() => {
                  setSourceMenuOpen(false);
                  setQualityMenuOpen((open) => !open);
                }}
                style={styles.playerPill}
              >
                <Text style={styles.playerPillText}>{qualityHeight == null ? t("auto") : `${qualityHeight}p`}</Text>
                <Ionicons name={qualityMenuOpen ? "chevron-up" : "chevron-down"} size={13} color={colors.text} />
              </Pressable>
            ) : null}
          </View>
          {sourceMenuOpen && source ? (
            <View style={styles.qualityMenu}>
              {visibleSources.map((item) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={SOURCE_LABELS[item].label}
                  accessibilityState={{ selected: source === item }}
                  key={item}
                  onPress={() => {
                    setSourceMenuOpen(false);
                    setPicked({ key: mediaKey, value: item });
                  }}
                  style={styles.qualityItem}
                >
                  <Text style={[styles.playerPillText, source === item && styles.qualityItemActive]}>
                    {SOURCE_LABELS[item].label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
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
