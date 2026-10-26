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
import { Button } from "../../components/Button";
import { RtRating, TmdbRating } from "../../components/Badges";
import { useLocale } from "../../providers/LocaleProvider";
import { getResumePosition, upsertPlayHistory, updatePlayHistoryProgress } from "../../storage/playHistory";
import { colors, fonts, spacing } from "../../theme";
import { createPlaybackLoader } from "./playbackLoader";
import { createProgressWriter } from "./progressWriter";
import {
  fetchAvailableSources,
  proxiedHlsUrl,
  resolveStream,
  selectPlaybackSource,
  type PlaybackSource,
  type StreamMedia,
} from "./resolveStream";
import NativeCastControls from "./CastControls";
import type { MobileMediaType, StreamResponse } from "../../types/api";

type Keyed<T> = { key: string; value: T };
function forMedia<T>(state: Keyed<T> | null, key: string): T | undefined { return state?.key === key ? state.value : undefined; }

export function PlayerScreen({ type, id, initialSeason, initialEpisode }: { type: MobileMediaType; id: number; initialSeason?: number; initialEpisode?: number }) {
  const { locale, t } = useLocale();
  const [season, setSeason] = useState(initialSeason ?? 1);
  const [episode, setEpisode] = useState(initialEpisode ?? 1);
  const [attempt, setAttempt] = useState(0);
  const [resolving, setResolving] = useState(false);
  const [available, setAvailable] = useState<Keyed<PlaybackSource[] | null> | null>(null);
  const [failed, setFailed] = useState<Keyed<PlaybackSource[]> | null>(null);
  const [playing, setPlaying] = useState<Keyed<PlaybackSource> | null>(null);
  const [stream, setStream] = useState<Keyed<StreamResponse> | null>(null);
  const [qualityHeight, setQualityHeight] = useState(0);
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);
  const [seasonPickerOpen, setSeasonPickerOpen] = useState(false);
  const [qualityPending, setQualityPending] = useState(false);
  const [message, setMessage] = useState('');
  const [casting, setCasting] = useState(false);
  const castingRef = useRef(false);
  const loadedKey = useRef<string | null>(null);
  const qualityBusy = useRef(false);
  const request = useRef(0);
  const validId = Number.isInteger(id) && id > 0;
  const details = useQuery({ queryKey: ['details', type, id, locale], queryFn: ({ signal }) => getMediaDetails(type, id, locale, signal), enabled: validId });
  const episodes = useQuery({ queryKey: ['season', id, season, locale], queryFn: ({ signal }) => getSeason(id, season, locale, signal), enabled: type === 'tv' && validId });
  const mediaKey = `${type}:${id}:${type === 'tv' ? `${season}:${episode}` : 'movie'}`;
  const title = details.data?.title ?? '';
  const posterUrl = details.data?.posterUrl ?? null;
  const backdropUrl = details.data?.backdropUrl ?? null;
  const date = details.data?.date ?? '';
  const rating = details.data?.rating ?? 0;
  const originalTitle = details.data?.stream.originalTitle || title;
  const year = details.data?.stream.year || date.slice(0, 4);
  const imdbId = details.data?.stream.imdbId;
  const streamMedia = useMemo<StreamMedia | null>(() => originalTitle ? { type, id, title: originalTitle, year, imdbId, ...(type === 'tv' ? { season, episode } : {}) } : null, [type, id, originalTitle, year, imdbId, season, episode]);
  const availableList = forMedia(available, mediaKey);
  const source = selectPlaybackSource(availableList, forMedia(failed, mediaKey) ?? [], forMedia(playing, mediaKey));
  const exhausted = source === null && availableList !== undefined;
  const currentStream = forMedia(stream, mediaKey);
  const player = useVideoPlayer(null, instance => { instance.loop = false; instance.timeUpdateEventInterval = 1; instance.keepScreenOnWhilePlaying = true; });
  const loader = useMemo(() => createPlaybackLoader(player), [player]);
  const progressWriter = useMemo(() => createProgressWriter((positionSeconds, durationSeconds) => updatePlayHistoryProgress({ type, id, season, episode, positionSeconds, durationSeconds })), [type, id, season, episode]);
  const handleCastingChange = useCallback((active: boolean) => { castingRef.current = active; setCasting(active); }, []);
  const handleRemoteProgress = useCallback((position: number, duration: number) => { void progressWriter.update(position, duration).catch(() => setMessage('saveFailed')); }, [progressWriter]);
  const handleCastDisconnect = useCallback((position: number, resume: boolean) => { if (Number.isFinite(position) && position >= 0) player.currentTime = position; if (resume) player.play(); }, [player]);

  useEffect(() => {
    const subscription = player.addListener('timeUpdate', ({ currentTime }) => {
      if (loadedKey.current === mediaKey && !qualityBusy.current && !castingRef.current) void progressWriter.update(currentTime, player.duration).catch(() => setMessage('saveFailed'));
    });
    return () => { subscription.remove(); void progressWriter.flush().catch(() => {}); };
  }, [player, progressWriter, mediaKey]);
  useEffect(() => {
    if (!streamMedia) return;
    let active = true;
    void fetchAvailableSources(streamMedia).then(value => { if (active) setAvailable({ key: mediaKey, value }); }).catch(() => { if (active) setAvailable({ key: mediaKey, value: null }); });
    return () => { active = false; };
  }, [streamMedia, mediaKey, attempt]);
  useEffect(() => {
    if (!streamMedia || !source) return;
    let cancelled = false;
    const failure = () => {
      if (!cancelled && !qualityBusy.current) setFailed(previous => {
        const values = forMedia(previous, mediaKey) ?? [];
        return { key: mediaKey, value: values.includes(source) ? values : [...values, source] };
      });
    };
    const subscription = player.addListener('statusChange', ({ status }) => { if (status === 'error' && loadedKey.current === mediaKey) failure(); });
    const token = ++request.current;
    queueMicrotask(() => { if (!cancelled) { setResolving(true); setQualityHeight(0); setQualityPending(false); setMessage(''); } });
    void (async () => {
      const position = await getResumePosition({ type, id, season, episode });
      const result = await resolveStream(streamMedia, source);
      if (cancelled) return;
      try { await upsertPlayHistory({ type, id, title, poster_path: posterUrl, backdrop_path: backdropUrl, date, vote_average: rating, ...(type === 'tv' ? { season, episode } : {}) }); }
      catch { if (!cancelled) setMessage('saveFailed'); }
      if (cancelled) return;
      const loaded = await loader.load(proxiedHlsUrl(result.url), position, () => !castingRef.current);
      if (!loaded || cancelled || request.current !== token) return;
      loadedKey.current = mediaKey;
      setStream({ key: mediaKey, value: result });
      setPlaying({ key: mediaKey, value: source });
    })().catch(failure).finally(() => { if (!cancelled) setResolving(false); });
    return () => { cancelled = true; request.current += 1; loadedKey.current = null; qualityBusy.current = false; subscription.remove(); loader.invalidate(); void progressWriter.flush().catch(() => {}); };
  }, [streamMedia, source, player, loader, mediaKey, type, id, season, episode, title, posterUrl, backdropUrl, date, rating, progressWriter, attempt]);

  async function changeQuality(height: number) {
    setQualityMenuOpen(false);
    if (!currentStream || qualityBusy.current || height === qualityHeight || loadedKey.current !== mediaKey) return;
    const file = height === 0 ? currentStream.url : currentStream.sources?.find(value => value.height === height)?.file;
    if (!file) return;
    const token = request.current;
    const position = player.currentTime;
    const resume = player.playing;
    const oldFile = qualityHeight === 0 ? currentStream.url : currentStream.sources?.find(value => value.height === qualityHeight)?.file ?? currentStream.url;
    qualityBusy.current = true; setQualityPending(true); setMessage('');
    try {
      const loaded = await loader.load(proxiedHlsUrl(file), position, () => resume && !castingRef.current);
      if (loaded && request.current === token) setQualityHeight(height);
    } catch {
      if (request.current === token) {
        setMessage('qualityFailed');
        try { await loader.load(proxiedHlsUrl(oldFile), position, () => resume && !castingRef.current); }
        catch { if (request.current === token) { setStream(null); setFailed(previous => ({ key: mediaKey, value: [...(forMedia(previous, mediaKey) ?? []), ...(source ? [source] : [])] })); } }
      }
    } finally { if (request.current === token) { qualityBusy.current = false; setQualityPending(false); } }
  }
  const qualityHeights = [...new Set((currentStream?.sources ?? []).map(source => source.height))].sort((a, b) => b - a);
  const streamError = message ? t(message === "saveFailed" ? "saveFailed" : "qualityFailed") : exhausted ? t("streamUnavailable") : null;
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
  if (!details.data) {
    return <View style={styles.center}><Text accessibilityRole="alert" style={styles.error}>{t("errorBody")}</Text><Button label={t('retry')} onPress={() => void details.refetch()} /></View>;
  }

  return (
    <View style={styles.screen}>
    <BackButton />
    <ScrollView style={styles.fill} contentContainerStyle={styles.content}>
      {details.isError ? <Text accessibilityRole="alert" style={styles.error}>{t('refreshFailed')}</Text> : null}
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
          fullscreenOptions={{ enable: true, orientation: "landscape" }}
        />
        {resolving || (source === null && !exhausted) ? (
          <View style={styles.overlay}><ActivityIndicator color="#fff" size="large" /></View>
        ) : null}
        <View style={styles.playerControls}>
          <View style={styles.playerPillGroup}>
            {currentStream ? <NativeCastControls
              player={player}
              mediaKey={mediaKey}
              source={currentStream
                ? qualityHeight === 0
                  ? currentStream.url
                  : currentStream.sources?.find((item) => item.height === qualityHeight)?.file ?? currentStream.url
                : null}
              tracks={currentStream?.tracks ?? []}
              title={details.data.title}
              onCastingChange={handleCastingChange}
              onDisconnect={handleCastDisconnect}
              onRemoteProgress={handleRemoteProgress}
            /> : null}
            {qualityHeights.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t("quality")}: ${qualityHeight === 0 ? t("auto") : `${qualityHeight}p`}`}
                disabled={qualityPending || resolving}
                accessibilityState={{ disabled: qualityPending || resolving, expanded: qualityMenuOpen }}
                onPress={() => {
                  setQualityMenuOpen((open) => !open);
                }}
                style={styles.playerPill}
              >
                <Text style={styles.playerPillText}>{qualityHeight === 0 ? t("auto") : `${qualityHeight}p`}</Text>
                <Ionicons name={qualityMenuOpen ? "chevron-up" : "chevron-down"} size={13} color={colors.text} />
              </Pressable>
            ) : null}
          </View>
          {qualityMenuOpen ? (
            <View style={styles.qualityMenu}>
              {[0, ...qualityHeights].map((height) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: qualityHeight === height }}
                  key={height || "auto"}
                  disabled={qualityPending || resolving}
                  onPress={() => void changeQuality(height)}
                  style={styles.qualityItem}
                >
                  <Text style={[styles.playerPillText, qualityHeight === height && styles.qualityItemActive]}>
                    {height === 0 ? t("auto") : `${height}p`}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </View>
      {streamError ? <Text accessibilityRole="alert" style={styles.error}>{streamError}</Text> : null}
      {exhausted ? <Pressable accessibilityRole="button" onPress={() => { setAvailable(null); setFailed(null); setPlaying(null); setStream(null); setAttempt(value => value + 1); }} style={styles.navButton}><Text style={styles.navButtonText}>{t('retry')}</Text></Pressable> : null}
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
          {episodes.isError ? <View><Text accessibilityRole="alert" style={styles.error}>{t(episodes.data ? 'refreshFailed' : 'errorBody')}</Text><Button secondary label={t('retry')} onPress={() => void episodes.refetch()} /></View> : null}
          {episodes.isLoading ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.episodeRow}>
              {Array.from({ length: 4 }).map((_, index) => (
                <View key={index} style={[styles.episodeCard, styles.episodeSkeleton]} />
              ))}
            </ScrollView>
          ) : !episodes.data?.episodes.length && !episodes.isError ? (
            <Text style={styles.metaText}>{t("noEpisodes")}</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.episodeRow}>
              {(episodes.data?.episodes ?? []).map((item) => {
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
  rated: { color: colors.accentText, fontSize: 14, fontFamily: fonts.bodySemiBold },
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
  qualityItemActive: { color: colors.accentText },
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
