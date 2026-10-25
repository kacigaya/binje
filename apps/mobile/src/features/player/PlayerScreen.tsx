import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { getMediaDetails, getSeason } from '../../api/media';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { Choice } from '../../components/Choice';
import { ErrorState, LoadingState } from '../../components/States';
import { useLocale } from '../../providers/LocaleProvider';
import { getResumePosition, upsertPlayHistory, updatePlayHistoryProgress } from '../../storage/playHistory';
import { colors, spacing, typography } from '../../theme';
import { createProgressWriter } from './progressWriter';
import { createPlaybackLoader } from './playbackLoader';
import { fetchAvailableSources, proxiedHlsUrl, resolveStream, selectPlaybackSource, type PlaybackSource, type StreamMedia } from './resolveStream';
import NativeCastControls from './CastControls';
import type { MobileMediaType, StreamResponse } from '../../types/api';

type Keyed<T> = { key: string; value: T };
function forMedia<T>(state: Keyed<T> | null, key: string): T | undefined { return state?.key === key ? state.value : undefined; }

export function PlayerScreen({ type, id, initialSeason, initialEpisode }: { type: MobileMediaType; id: number; initialSeason?: number; initialEpisode?: number }) {
  useColorScheme();
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
  function retryStream() { setAvailable(null); setFailed(null); setPlaying(null); setStream(null); setAttempt(value => value + 1); }
  const seasons = (details.data?.seasons ?? []).filter(value => value.seasonNumber > 0);
  const currentSeason = seasons.find(value => value.seasonNumber === season);
  const hasPrevious = episode > 1 || seasons.some(value => value.seasonNumber === season - 1);
  const hasNext = episode < (currentSeason?.episodeCount ?? 1) || seasons.some(value => value.seasonNumber === season + 1);
  const selectEpisode = (nextSeason: number, nextEpisode: number) => { setSeason(nextSeason); setEpisode(nextEpisode); };
  if (!details.data) return <Screen title={t('watchNow')}>{details.isError || !validId ? <ErrorState onRetry={() => void details.refetch()} /> : <LoadingState />}</Screen>;
  return <Screen title={title}>
    {details.isError ? <ErrorState body={t('refreshFailed')} onRetry={() => void details.refetch()} /> : null}
    <VideoView player={player} style={styles.video} nativeControls={!casting} contentFit="contain" allowsPictureInPicture fullscreenOptions={{ enable: true, orientation: 'landscape' }} />
    {resolving ? <ActivityIndicator color={colors.accent} accessibilityLabel={t('loading')} /> : null}
    {exhausted ? <ErrorState body={t('streamUnavailable')} onRetry={retryStream} /> : null}
    {message ? <Text selectable accessibilityRole="alert" style={styles.error}>{t(message === 'saveFailed' ? 'saveFailed' : 'qualityFailed')}</Text> : null}
    {currentStream ? <>
      <View style={{ padding: spacing.md }}><NativeCastControls player={player} mediaKey={mediaKey}
        source={qualityHeight === 0 ? currentStream.url : currentStream.sources?.find(value => value.height === qualityHeight)?.file ?? currentStream.url}
        tracks={currentStream.tracks ?? []} title={title} onCastingChange={handleCastingChange} onDisconnect={handleCastDisconnect} onRemoteProgress={handleRemoteProgress} /></View>
      {currentStream.sources?.length ? <Choice label={t('quality')} value={qualityHeight} disabled={qualityPending || resolving}
        options={[{ value: 0, label: t('auto') }, ...[...new Set(currentStream.sources.map(value => value.height))].sort((a, b) => b - a).map(value => ({ value, label: `${value}p` }))]}
        onChange={value => void changeQuality(value)} /> : null}
    </> : null}
    {type === 'tv' ? <>
      {seasons.length ? <Choice label={t('season')} value={season} options={seasons.map(value => ({ value: value.seasonNumber, label: value.name }))} onChange={value => selectEpisode(value, 1)} /> : null}
      <Text style={styles.heading}>{currentSeason?.name ?? `${t('season')} ${season}`}, {t('episode')} {episode}</Text>
      <View style={styles.actions}>
        <Button label={t('previous')} secondary disabled={!hasPrevious} onPress={() => {
          if (episode > 1) selectEpisode(season, episode - 1);
          else { const target = seasons.find(value => value.seasonNumber === season - 1); if (target) selectEpisode(target.seasonNumber, target.episodeCount); }
        }} />
        <Button label={t('next')} disabled={!hasNext} onPress={() => { if (episode < (currentSeason?.episodeCount ?? 1)) setEpisode(episode + 1); else selectEpisode(season + 1, 1); }} />
      </View>
      {episodes.isError ? <ErrorState body={episodes.data ? t('refreshFailed') : undefined} onRetry={() => void episodes.refetch()} /> : null}
      {!episodes.data && episodes.isLoading ? <LoadingState /> : null}
      {episodes.data?.episodes.length === 0 ? <Text style={styles.body}>{t('noEpisodes')}</Text> : null}
      <FlatList horizontal data={episodes.data?.episodes ?? []} keyExtractor={item => String(item.id)} contentContainerStyle={{ padding: spacing.md, gap: spacing.md }} renderItem={({ item }) => <View style={{ width: 240, gap: spacing.sm }}>
        {item.stillUrl ? <Image source={item.stillUrl} alt="" style={{ width: '100%', aspectRatio: 16 / 9 }} contentFit="cover" /> : null}
        <Text style={styles.body}>{item.name}</Text>
        <Button label={`${item.episodeNumber}. ${item.name}${item.episodeNumber === episode ? ` · ${t('watching')}` : ''}`} secondary={item.episodeNumber !== episode} onPress={() => setEpisode(item.episodeNumber)} />
      </View>} />
    </> : null}
  </Screen>;
}
const styles = StyleSheet.create({ video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.mediaBackground }, heading: { ...typography.heading, color: colors.text, padding: spacing.md }, body: { ...typography.body, color: colors.muted }, error: { color: colors.destructive, padding: spacing.md }, actions: { gap: spacing.sm, paddingHorizontal: spacing.md } });
