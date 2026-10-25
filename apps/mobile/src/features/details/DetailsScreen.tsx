import { Column, Host, ListItem } from '@expo/ui';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { getMediaDetails } from '../../api/media';
import type { MobileMediaType } from '../../types/api';
import { useLocale } from '../../providers/LocaleProvider';
import { useWatchlist } from '../../hooks/useWatchlist';
import { addToWatchlist, removeFromWatchlist } from '../../storage/watchlist';
import { useToast } from '../../providers/ToastProvider';
import { Screen } from '../../components/Screen';
import { TmdbRating, RtRating } from '../../components/Badges';
import { Button } from '../../components/Button';
import { MediaRow } from '../../components/MediaRow';
import { ErrorState, LoadingState } from '../../components/States';
import { colors, spacing, typography } from '../../theme';

export default function DetailsScreen({ type, id }: { type: MobileMediaType; id: number }) {
  const scheme = useColorScheme();
  const { locale, t } = useLocale();
  const w = useWatchlist(); const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const q = useQuery({ queryKey: ['details', type, id, locale], queryFn: ({ signal }) => getMediaDetails(type, id, locale, signal), enabled: Number.isInteger(id) && id > 0 });
  const d = q.data;
  async function setSaved(target: boolean, undo = true) {
    if (!d || busy.current) return;
    busy.current = true; setSaving(true); setError('');
    const input = { type, id, title: d.title, poster_path: d.posterUrl, backdrop_path: d.backdropUrl, date: d.date, vote_average: d.rating };
    try {
      const changed = await (target ? addToWatchlist(input) : removeFromWatchlist(input));
      if (!changed) { setError(t('storageRequired')); return; }
      toast.show({ message: target ? t('addedToWatchlist') : t('removedFromWatchlist'),
        ...(undo ? { actionLabel: t('undo'), onAction: () => void setSaved(!target, false) } : {}) });
    } catch { setError(t('saveFailed')); }
    finally { busy.current = false; setSaving(false); }
  }
  if (!d) return <Screen title={t('details')}>{q.isError || !Number.isInteger(id) || id < 1 ? <ErrorState onRetry={() => void q.refetch()} /> : <LoadingState />}</Screen>;
  const saved = w.contains({ type, id });
  return <Screen title={d.title} refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />}>
    {q.isError ? <ErrorState body={t('refreshFailed')} onRetry={() => void q.refetch()} /> : null}
    {d.backdropUrl ? <Image source={d.backdropUrl} alt={d.title} style={{ width: '100%', aspectRatio: 16 / 9 }} contentFit="cover" /> : null}
    <View style={styles.content}>
      {d.tagline ? <Text style={styles.body}>{d.tagline}</Text> : null}
      <View style={styles.meta}><TmdbRating rating={d.rating.toFixed(1)} />{d.rottenTomatoesScore != null ? <RtRating score={d.rottenTomatoesScore} /> : null}<Text style={styles.body}>{d.date.slice(0, 4)}{d.runtime ? ` · ${d.runtime} min` : ''}{d.contentRating ? ` · ${d.contentRating}` : ''}</Text></View>
      <Text style={styles.body}>{d.genres.map(genre => genre.name).join(' · ')}</Text>
      <Button label={t('watchNow')} onPress={() => router.push(`/watch/${type}/${id}`)} />
      <Button secondary label={saved ? t('removeFromWatchlist') : t('addToWatchlist')} loading={saving} disabled={w.isLoading} onPress={() => void setSaved(!saved)} />
      {error ? <Text selectable accessibilityRole="alert" style={{ color: colors.destructive }}>{error}</Text> : null}
      <Text accessibilityRole="header" style={styles.heading}>{t('overview')}</Text><Text selectable style={styles.body}>{d.overview}</Text>
      {d.creators.length ? <><Text style={styles.heading}>{type === 'movie' ? t('director') : t('createdBy')}</Text><Text selectable style={styles.body}>{d.creators.map(person => person.name).join(', ')}</Text></> : null}
    </View>
    {d.cast.length ? <><Text accessibilityRole="header" style={[styles.heading, { padding: spacing.md }]}>{t('cast')}</Text>
      <FlatList horizontal data={d.cast.slice(0, 12)} keyExtractor={person => String(person.id)} contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.md }}
        renderItem={({ item }) => <View style={{ width: 112, gap: spacing.sm }}>{item.profileUrl ? <Image source={item.profileUrl} alt={item.name} style={{ width: 96, height: 128, borderRadius: 8 }} contentFit="cover" /> : null}<Text style={styles.body}>{item.name}</Text><Text style={styles.body}>{item.role}</Text></View>} />
    </> : null}
    {type === 'tv' && d.seasons.some(season => season.seasonNumber > 0) ? <>
      <Text accessibilityRole="header" style={[styles.heading, { padding: spacing.md }]}>{t('seasons')}</Text>
      <Host matchContents={{ vertical: true }} colorScheme={scheme} seedColor={colors.accent}><Column>
        {d.seasons.filter(season => season.seasonNumber > 0).map(season => <ListItem key={season.id} supportingText={`${season.episodeCount} ${t('episodes')}`} onPress={() => router.push({ pathname: '/watch/tv/[id]', params: { id, season: season.seasonNumber } })}>{season.name}</ListItem>)}
      </Column></Host>
    </> : null}
    <MediaRow title={t('related')} items={d.related} />
  </Screen>;
}
const styles = StyleSheet.create({ content: { padding: spacing.md, gap: spacing.md }, meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md }, heading: { ...typography.heading, color: colors.text }, body: { ...typography.body, color: colors.muted } });
