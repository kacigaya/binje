import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TVPressable as Pressable } from '../../components/TVPressable'; import { BackHandler, Platform, ActivityIndicator, ScrollView, TVFocusGuideView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { VideoView, useVideoPlayer } from "expo-video";
import { ControlPill, IconButton, PlayerControls } from "./PlayerControls";
import { Captions } from "./Captions";
import { fetchCues, fetchTitleSubtitles, trackLabels, type SubtitleTrack } from "./subtitles";
import { EpisodePanel } from "./EpisodePanel";
import { UpNextCard } from "./UpNextCard";
import { playlistQualities, type Quality } from "./qualities";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getMediaDetails, getSeason } from "../../api/media";
import { BackButton } from "../../components/BackButton";
import { Button } from "../../components/Button";
import { useLocale } from "../../providers/LocaleProvider";
import { getResumePosition, upsertPlayHistory, updatePlayHistoryProgress } from "../../storage/playHistory";
import { colors, fonts, screenPadding } from "../../theme";
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

// Only TV has focus guides; react-native-web has no TVFocusGuideView, and touch needs no trap.
const FocusTrap = Platform.isTV ? TVFocusGuideView : View;

type Keyed<T> = { key: string; value: T };
function forMedia<T>(state: Keyed<T> | null, key: string): T | undefined { return state?.key === key ? state.value : undefined; }

export function PlayerScreen({ type, id, initialSeason, initialEpisode }: { type: MobileMediaType; id: number; initialSeason?: number; initialEpisode?: number }) {
  const { locale, t } = useLocale();
  const insets = useSafeAreaInsets();
  const [season, setSeason] = useState(initialSeason ?? 1);
  const [episode, setEpisode] = useState(initialEpisode ?? 1);
  const [attempt, setAttempt] = useState(0);
  const [resolving, setResolving] = useState(false);
  const [available, setAvailable] = useState<Keyed<PlaybackSource[] | null> | null>(null);
  const [failed, setFailed] = useState<Keyed<PlaybackSource[]> | null>(null);
  const [playing, setPlaying] = useState<Keyed<PlaybackSource> | null>(null);
  const [stream, setStream] = useState<Keyed<StreamResponse> | null>(null);
  const [qualityHeight, setQualityHeight] = useState(0);
  const [variants, setVariants] = useState<Keyed<Quality[]> | null>(null);
  const [menu, setMenu] = useState<'quality' | 'subtitles' | 'episodes' | null>(null);
  const qualityMenuOpen = menu === 'quality';
  // The episode panel can browse another season without changing playback.
  const [panelSeason, setPanelSeason] = useState(initialSeason ?? 1);
  // The media key of an episode that ended with another one after it.
  const [ended, setEnded] = useState<string | null>(null);
  const [qualityPending, setQualityPending] = useState(false);
  const [message, setMessage] = useState('');
  const [casting, setCasting] = useState(false);
  const [crop, setCrop] = useState(false);
  // Picked by file, with the label to find the same language in the next episode. null file: subtitles off.
  const [subtitleChoice, setSubtitleChoice] = useState<{ file: string | null; label?: string } | null>(null);
  const [firstFrame, setFirstFrame] = useState<string | null>(null);
  const videoRef = useRef<VideoView>(null);
  const castingRef = useRef(false);
  const loadedKey = useRef<string | null>(null);
  const qualityBusy = useRef(false);
  const qualityButton = useRef<View>(null);
  const subtitlesButton = useRef<View>(null);
  const episodesButton = useRef<View>(null);
  const lastMenu = useRef<typeof menu>(null);
  const request = useRef(0);
  const validId = Number.isInteger(id) && id > 0;
  const details = useQuery({ queryKey: ['details', type, id, locale], queryFn: ({ signal }) => getMediaDetails(type, id, locale, signal), enabled: validId });
  // The playing season names the episode in the TV bar and the next one in the Up next card.
  const playingEpisodes = useQuery({ queryKey: ['season', id, season, locale], queryFn: ({ signal }) => getSeason(id, season, locale, signal), enabled: type === 'tv' && validId });
  const episodes = useQuery({ queryKey: ['season', id, panelSeason, locale], queryFn: ({ signal }) => getSeason(id, panelSeason, locale, signal), enabled: type === 'tv' && validId && menu === 'episodes' });
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
  const player = useVideoPlayer(null, instance => { instance.loop = false; instance.timeUpdateEventInterval = 0.25; instance.keepScreenOnWhilePlaying = true; });
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
  // Tracks can arrive after the load resolves. A single variant reports one track, which keeps the list.
  useEffect(() => {
    const subscription = player.addListener('sourceLoad', ({ availableVideoTracks }) => {
      const list = playlistQualities(availableVideoTracks);
      if (list.length && loadedKey.current === mediaKey) setVariants({ key: mediaKey, value: list });
    });
    return () => subscription.remove();
  }, [player, mediaKey]);
  useEffect(() => {
    if (!streamMedia) return;
    let active = true;
    void fetchAvailableSources(streamMedia).then(value => { if (active) setAvailable({ key: mediaKey, value }); }).catch(() => { if (active) setAvailable({ key: mediaKey, value: null }); });
    return () => { active = false; };
  }, [streamMedia, mediaKey, attempt]);
  useEffect(() => {
    player.pause();
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
      const list = playlistQualities(player.availableVideoTracks ?? []);
      if (list.length) setVariants({ key: mediaKey, value: list });
      setStream({ key: mediaKey, value: result });
      setPlaying({ key: mediaKey, value: source });
    })().catch(failure).finally(() => { if (!cancelled) setResolving(false); });
    return () => { cancelled = true; request.current += 1; loadedKey.current = null; qualityBusy.current = false; subscription.remove(); loader.invalidate(); void progressWriter.flush().catch(() => {}); };
  }, [streamMedia, source, player, loader, mediaKey, type, id, season, episode, title, posterUrl, backdropUrl, date, rating, progressWriter, attempt]);

  // A show offers the next episode when one ends; casting plays elsewhere, so it never ends here.
  useEffect(() => {
    const subscriptions = [
      player.addListener('playToEnd', () => { if (loadedKey.current === mediaKey && !castingRef.current) setEnded(mediaKey); }),
      // Replaying after the end, such as with a remote's play key, must not advance mid-replay.
      player.addListener('playingChange', ({ isPlaying }) => { if (isPlaying) setEnded(null); }),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [player, mediaKey]);

  // On TV the focused menu item unmounts with the menu, so focus goes back to the button that opened it.
  useEffect(() => {
    const closed = lastMenu.current;
    if (Platform.isTV && closed && !menu) requestAnimationFrame(() => ({ quality: qualityButton, subtitles: subtitlesButton, episodes: episodesButton })[closed].current?.requestTVFocus());
    lastMenu.current = menu;
  }, [menu]);

  async function changeQuality(height: number) {
    setMenu(null);
    if (!currentStream || qualityBusy.current || height === qualityHeight || loadedKey.current !== mediaKey) return;
    const url = qualityUrl(height);
    if (!url) return;
    const token = request.current;
    const position = player.currentTime;
    const resume = player.playing;
    const oldUrl = qualityUrl(qualityHeight) ?? proxiedHlsUrl(currentStream.url);
    qualityBusy.current = true; setQualityPending(true); setMessage('');
    try {
      const loaded = await loader.load(url, position, () => resume && !castingRef.current);
      if (loaded && request.current === token) setQualityHeight(height);
    } catch {
      if (request.current === token) {
        setMessage('qualityFailed');
        try { await loader.load(oldUrl, position, () => resume && !castingRef.current); }
        catch { if (request.current === token) { setStream(null); setFailed(previous => ({ key: mediaKey, value: [...(forMedia(previous, mediaKey) ?? []), ...(source ? [source] : [])] })); } }
      }
    } finally { if (request.current === token) { qualityBusy.current = false; setQualityPending(false); } }
  }
  // Prefer the separate files from the API; otherwise offer the variants of the HLS playlist.
  const apiQualities: Quality[] = (currentStream?.sources ?? []).map(item => ({ height: item.height, url: proxiedHlsUrl(item.file) }));
  const qualities = apiQualities.length ? apiQualities : forMedia(variants, mediaKey) ?? [];
  const qualityHeights = [...new Set(qualities.map(item => item.height))].sort((a, b) => b - a);
  function qualityUrl(height: number) {
    if (!currentStream) return undefined;
    return height === 0 ? proxiedHlsUrl(currentStream.url) : qualities.find(item => item.height === height)?.url;
  }
  // Like the web player: the source's own tracks start on, title-wide ones wait to be picked.
  const streamTracks: SubtitleTrack[] = currentStream?.tracks ?? [];
  const titleTracks = useQuery({
    queryKey: ['subtitles', mediaKey],
    queryFn: ({ signal }) => fetchTitleSubtitles(streamMedia!, signal),
    enabled: streamMedia !== null && currentStream !== undefined && streamTracks.length === 0,
  });
  const subtitleTracks = streamTracks.length ? streamTracks : titleTracks.data ?? [];
  const subtitleNames = trackLabels(subtitleTracks, (index) => `${t("subtitles")} ${index}`);
  const activeTrack = subtitleChoice === null
    ? streamTracks[0]
    : subtitleChoice.file === null
      ? undefined
      : subtitleTracks.find((track) => track.file === subtitleChoice.file) ?? subtitleTracks.find((track) => track.label === subtitleChoice.label) ?? subtitleTracks[0];
  const cues = useQuery({
    queryKey: ['subtitleCues', activeTrack?.file, activeTrack?.format],
    queryFn: ({ signal }) => fetchCues(activeTrack!, signal),
    enabled: activeTrack !== undefined && !casting,
    staleTime: Infinity,
  });
  const streamError = message ? t(message === "saveFailed" ? "saveFailed" : "qualityFailed") : activeTrack && cues.isError ? t("subtitlesFailed") : null;
  const status = exhausted ? null : source === null ? t("checkingSources") : resolving ? t("loading") : null;
  const seasonList = (details.data?.seasons ?? []).filter((item) => item.seasonNumber > 0);
  const currentSeason = seasonList.find((item) => item.seasonNumber === season);
  const maxEpisodes = currentSeason?.episodeCount ?? 1;
  const hasPrev = episode > 1 || seasonList.some((item) => item.seasonNumber === season - 1);
  const hasNext = episode < maxEpisodes || seasonList.some((item) => item.seasonNumber === season + 1);

  // The next episode for the Up next card. A new season's first episode has no loaded name yet.
  const nextInSeason = episode < maxEpisodes;
  const nextItem = nextInSeason ? playingEpisodes.data?.episodes.find((item) => item.episodeNumber === episode + 1) : undefined;
  const upNext = type === "tv" && hasNext ? {
    label: [nextInSeason ? `S${season}:E${episode + 1}` : `S${season + 1}:E1`, nextItem?.name].filter(Boolean).join(" · "),
    stillUrl: nextItem?.stillUrl ?? null,
  } : null;
  const upNextOpen = ended === mediaKey && upNext !== null;

  // Android phones have no remote handler, so Back closes an open panel or card before it leaves the player.
  const overlayOpen = menu !== null || upNextOpen;
  useEffect(() => {
    if (Platform.OS !== 'android' || Platform.isTV || !overlayOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { setMenu(null); setEnded(null); return true; });
    return () => subscription.remove();
  }, [overlayOpen]);

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

  const playingName = playingEpisodes.data?.episodes.find((item) => item.episodeNumber === episode)?.name;
  const runtime = details.data.runtime ? `${Math.floor(details.data.runtime / 60)}\u00a0h ${details.data.runtime % 60}\u00a0m` : "";
  const tvHeading = {
    title: details.data.title,
    logoUrl: details.data.logoUrl,
    subtitle: type === "tv"
      ? [`S${season}:E${episode}`, playingName].filter(Boolean).join(" · ")
      : [details.data.date.slice(0, 4), runtime].filter(Boolean).join(" · "),
  };

  const videoLayers = (
    <>
    <VideoView
      player={player}
      style={styles.video}
      ref={videoRef}
      nativeControls={false}
      contentFit={crop ? "cover" : "contain"}
      allowsPictureInPicture
      fullscreenOptions={{ enable: true, orientation: "landscape" }}
      onFirstFrameRender={() => setFirstFrame(mediaKey)}
    />
    {/* Like the web video poster: the backdrop shows until the first frame. */}
    {backdropUrl && firstFrame !== mediaKey ? (
      <Image pointerEvents="none" source={backdropUrl} alt="" style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
    ) : null}
    <PlayerControls
      player={player}
      insets={insets}
      disabled={casting || exhausted}
      status={status}
      captions={activeTrack && cues.data && !casting ? <Captions key={activeTrack.file} player={player} cues={cues.data} /> : null}
      menuOpen={menu !== null || upNextOpen}
      onCloseMenu={() => { setMenu(null); setEnded(null); }}
      heading={Platform.isTV ? tvHeading : undefined}
      hideBar={menu === "episodes" || upNextOpen}
      episodeButtons={type === "tv" ? <>
        {Platform.isTV ? <IconButton label={t("previousEpisode")} disabled={!hasPrev} onPress={prevEpisode}>{(ink) => <Feather name="skip-back" size={22} color={ink} />}</IconButton> : null}
        <ControlPill
          buttonRef={episodesButton}
          label={t("episodes")}
          expanded={menu === "episodes"}
          onPress={() => { setPanelSeason(season); setMenu((open) => open === "episodes" ? null : "episodes"); }}
          icon={(ink) => <Feather name="list" size={Platform.isTV ? 20 : 16} color={ink} />}
        />
        <ControlPill
          label={Platform.isTV ? t("next") : t("nextEpisode")}
          accessibilityLabel={t("nextEpisode")}
          disabled={!hasNext}
          onPress={nextEpisode}
          iconAfter={(ink) => <Feather name="skip-forward" size={Platform.isTV ? 20 : 16} color={ink} />}
        />
      </> : undefined}
      crop={crop}
      onCrop={() => setCrop((value) => !value)}
      leading={Platform.isTV ? undefined : <BackButton floating={false} />}
      onPip={() => void videoRef.current?.startPictureInPicture()}
      toolbar={<>
        {subtitleTracks.length > 0 ? (
          <IconButton
            buttonRef={subtitlesButton}
            label={t("subtitles")}
            selected={activeTrack !== undefined}
            expanded={menu === "subtitles"}
            onPress={() => setMenu((open) => open === "subtitles" ? null : "subtitles")}
          >
            {(ink) => <MaterialCommunityIcons name={activeTrack ? "closed-caption" : "closed-caption-outline"} size={Platform.isTV ? 24 : 18} color={ink} />}
          </IconButton>
        ) : null}
        {qualityHeights.length > 0 && Platform.isTV ? (
          <ControlPill
            buttonRef={qualityButton}
            label={qualityHeight === 0 ? t("auto") : `${qualityHeight}p`}
            accessibilityLabel={`${t("quality")}: ${qualityHeight === 0 ? t("auto") : `${qualityHeight}p`}`}
            disabled={qualityPending || resolving}
            expanded={qualityMenuOpen}
            onPress={() => setMenu((open) => open === "quality" ? null : "quality")}
            // The TV menu opens upward from the bottom bar.
            iconAfter={(ink) => <Feather name="chevron-up" size={18} color={ink} />}
          />
        ) : qualityHeights.length > 0 ? (
          <Pressable
            ref={qualityButton}
            accessibilityRole="button"
            accessibilityLabel={`${t("quality")}: ${qualityHeight === 0 ? t("auto") : `${qualityHeight}p`}`}
            disabled={qualityPending || resolving}
            accessibilityState={{ disabled: qualityPending || resolving, expanded: qualityMenuOpen }}
            onPress={() => {
              setMenu((open) => open === "quality" ? null : "quality");
            }}
            style={({ pressed }) => [styles.playerPill, pressed && styles.playerPillPressed]}
          >
            <Text style={styles.playerPillText}>{qualityHeight === 0 ? t("auto") : `${qualityHeight}p`}</Text>
            <Feather name="chevron-down" size={14} color="rgba(255,255,255,0.7)" />
          </Pressable>
        ) : null}
        {currentStream && !Platform.isTV ? <NativeCastControls
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
      </>}
    />
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { top: insets.top, right: insets.right, bottom: insets.bottom, left: insets.left }]}>
    {qualityMenuOpen ? (
      // On TV the D-pad stays in the open menu, like the episode panel; Back closes it.
      <FocusTrap trapFocusUp trapFocusDown trapFocusLeft trapFocusRight style={[styles.qualityMenu, Platform.isTV ? styles.tvQualityMenu : styles.phoneQualityMenu]}>
        {Platform.isTV ? <Text style={styles.tvMenuCaption}>{t("quality")}</Text> : null}
        {[0, ...qualityHeights].map((height) => (
          <MenuOption
            key={height || "auto"}
            label={height === 0 ? t("auto") : `${height}p`}
            selected={qualityHeight === height}
            disabled={qualityPending || resolving}
            onPress={() => void changeQuality(height)}
          />
        ))}
      </FocusTrap>
    ) : null}
    {menu === "subtitles" ? (
      <FocusTrap trapFocusUp trapFocusDown trapFocusLeft trapFocusRight style={[styles.qualityMenu, Platform.isTV ? styles.tvQualityMenu : styles.phoneQualityMenu]}>
        {Platform.isTV ? <Text style={styles.tvMenuCaption}>{t("subtitles")}</Text> : null}
        {/* Title-wide lists can hold many languages. */}
        <ScrollView style={Platform.isTV ? styles.tvMenuList : styles.menuList}>
          <MenuOption label={t("off")} selected={activeTrack === undefined} onPress={() => { setMenu(null); setSubtitleChoice({ file: null }); }} />
          {subtitleTracks.map((track, index) => (
            <MenuOption
              key={track.file}
              label={subtitleNames[index]}
              selected={activeTrack?.file === track.file}
              onPress={() => { setMenu(null); setSubtitleChoice({ file: track.file, label: track.label }); }}
            />
          ))}
        </ScrollView>
      </FocusTrap>
    ) : null}
    {menu === "episodes" && !Platform.isTV ? <Pressable accessibilityElementsHidden importantForAccessibility="no" onPress={() => setMenu(null)} style={StyleSheet.absoluteFill} /> : null}
    {menu === "episodes" ? (
      <View style={styles.episodePanel}>
        <EpisodePanel
          title={details.data.title}
          seasons={seasonList}
          season={panelSeason}
          onSeasonChange={setPanelSeason}
          episodes={episodes.data?.episodes ?? []}
          loading={episodes.isLoading}
          failed={episodes.isError && !episodes.data}
          onRetry={() => void episodes.refetch()}
          playingSeason={season}
          playingEpisode={episode}
          onSelect={(value) => { setMenu(null); selectEpisode(panelSeason, value); }}
          onClose={() => setMenu(null)}
        />
      </View>
    ) : null}
    {upNextOpen && upNext ? <UpNextCard key={mediaKey} label={upNext.label} stillUrl={upNext.stillUrl} onPlay={() => { setEnded(null); nextEpisode(); }} onCancel={() => setEnded(null)} /> : null}
    </View>
    {exhausted ? (
      <View pointerEvents="box-none" style={[styles.overlay, styles.overlayDim]}>
        <Text accessibilityRole="alert" style={styles.overlayText}>{t("streamUnavailable")}</Text>
        <Pressable
          hasTVPreferredFocus={Platform.isTV}
          accessibilityRole="button"
          onPress={() => { setAvailable(null); setFailed(null); setPlaying(null); setStream(null); setAttempt(value => value + 1); }}
          style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
        >
          <Feather name="rotate-ccw" size={16} color={colors.text} />
          <Text style={styles.navButtonText}>{t("retry")}</Text>
        </Pressable>
      </View>
    ) : null}
    </>
  );

  // Leaving goes back to the details screen. On TV, the remote's back key hides the controls first, then leaves.
  return (
    <View style={styles.immersive}>
      {videoLayers}
      {streamError ? <Text accessibilityRole="alert" style={[styles.immersiveError, { bottom: insets.bottom + 56 }]}>{streamError}</Text> : null}
    </View>
  );
}

function MenuOption({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      hasTVPreferredFocus={Platform.isTV && selected}
      focusStyle={styles.qualityItemFocused}
      style={({ pressed }) => [styles.qualityItem, Platform.isTV && styles.tvQualityItem, pressed && styles.qualityItemPressed]}
    >
      {({ focused }) => {
        // TV focus inverts the item, like the bar's buttons.
        const ink = Platform.isTV && focused ? "#0a0a0b" : colors.text;
        return <>
          <Text numberOfLines={1} style={[styles.qualityItemText, Platform.isTV && styles.tvQualityItemText, { color: ink }]}>{label}</Text>
          {selected ? <Feather name="check" size={Platform.isTV ? 18 : 14} color={ink} /> : null}
        </>;
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  immersive: { flex: 1, backgroundColor: "#000" },
  immersiveError: { position: "absolute", alignSelf: "center", maxWidth: "80%", overflow: "hidden", borderRadius: 999, backgroundColor: "rgba(0,0,0,0.75)", color: colors.destructive, fontSize: 13, fontFamily: fonts.bodyMedium, paddingHorizontal: 12, paddingVertical: 6 },
  video: { flex: 1 },
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 24 },
  overlayDim: { backgroundColor: "rgba(0,0,0,0.6)" },
  overlayText: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontFamily: fonts.bodyMedium, textAlign: "center" },
  retryButton: { flexDirection: "row", alignItems: "center", gap: 8, height: 36, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.04)", paddingHorizontal: 16 },
  retryButtonPressed: { backgroundColor: "rgba(255,255,255,0.06)" },
  playerPill: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 44, borderRadius: 999, paddingHorizontal: 12, backgroundColor: "rgba(255,255,255,0.1)" },
  playerPillPressed: { backgroundColor: "rgba(255,255,255,0.15)" },
  playerPillText: { color: "#fff", fontSize: 12, fontFamily: fonts.bodySemiBold, fontVariant: ["tabular-nums"] },
  phoneQualityMenu: { top: 64, right: 8 },
  // Above the TV bar: its 24 pt bottom offset, a 56 pt button row and a 12 pt gap.
  tvQualityMenu: { bottom: 92, right: screenPadding, minWidth: 200, padding: 6, borderRadius: 18 },
  episodePanel: { position: "absolute", left: 0, right: 0, bottom: 0 },
  tvMenuCaption: { color: colors.muted, fontSize: 13, fontFamily: fonts.bodySemiBold, letterSpacing: 0.6, textTransform: "uppercase", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  menuList: { maxHeight: 240 },
  tvMenuList: { maxHeight: 420 },
  tvQualityItem: { paddingHorizontal: 16, paddingVertical: 12 },
  tvQualityItemText: { fontSize: 18 },
  qualityItemFocused: { backgroundColor: "#fff" },
  qualityMenu: { position: "absolute", backgroundColor: colors.surface, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", borderRadius: 16, padding: 4, minWidth: 120, boxShadow: "0 10px 15px rgba(0,0,0,0.4)" },
  qualityItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  qualityItemPressed: { backgroundColor: "rgba(255,255,255,0.1)" },
  qualityItemText: { color: colors.text, fontSize: 14, fontFamily: fonts.body, fontVariant: ["tabular-nums"] },
  error: { color: colors.destructive, textAlign: "center", padding: 16 },
  navButtonText: { color: colors.text, fontSize: 14, fontFamily: fonts.bodyMedium },
});
