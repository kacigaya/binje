import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { usePlayHistory } from '../hooks/usePlayHistory';
import { formatPlaybackTimings, type PlayHistoryItem } from '../storage/playHistory';
import { useLocale } from '../providers/LocaleProvider';
import { Button } from './Button';
import { colors, radius, spacing, typography } from '../theme';
function Card({ item, onRemove }: { item: PlayHistoryItem; onRemove: () => Promise<boolean> }) {
  useColorScheme();
  const { t } = useLocale();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const image = item.backdrop_path ?? item.poster_path;
  async function remove() {
    if (busy.current) return;
    busy.current = true; setPending(true); setError('');
    try { if (!await onRemove()) setError(t('storageRequired')); }
    catch { setError(t('saveFailed')); }
    finally { busy.current = false; setPending(false); }
  }
  const href = item.type === 'tv' ? { pathname: '/watch/tv/[id]' as const, params: { id: item.id, season: item.season ?? 1, episode: item.episode ?? 1 } } : { pathname: '/watch/movie/[id]' as const, params: { id: item.id } };
  return <View style={{ width: 240, gap: spacing.sm }}>
    <Link href={href} asChild><Pressable accessibilityRole="link" accessibilityLabel={item.title} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
      <View style={styles.card}>{image ? <Image source={image} alt="" style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        <Text style={styles.timing}>{formatPlaybackTimings(item)}</Text>
        <View style={styles.track}><View style={{ height: 4, backgroundColor: colors.accent, width: `${Math.round((item.progress ?? 0) * 100)}%` }} /></View>
      </View><Text style={styles.title}>{item.title}</Text>
    </Pressable></Link>
    <Button secondary label={t('removeHistory')} loading={pending} onPress={() => void remove()} />
    {error ? <Text accessibilityRole="alert" style={{ color: colors.destructive }}>{error}</Text> : null}
  </View>;
}
export function ContinueWatching() {
  useColorScheme();
  const { t } = useLocale(); const history = usePlayHistory();
  if (!history.items.length) return null;
  return <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
    <Text accessibilityRole="header" style={styles.heading}>{t('continueWatching')}</Text>
    <FlatList horizontal data={history.items} keyExtractor={item => `${item.type}-${item.id}`} renderItem={({ item }) => <Card item={item} onRemove={() => history.remove(item)} />} contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.md }} />
  </View>;
}
const styles = StyleSheet.create({ heading: { ...typography.heading, color: colors.text, paddingHorizontal: spacing.md }, card: { aspectRatio: 16 / 9, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.mediaBackground, justifyContent: 'flex-end' }, title: { color: colors.text, fontSize: 16, marginTop: spacing.sm }, timing: { color: colors.onMedia, backgroundColor: 'rgba(0,0,0,0.75)', padding: spacing.xs, fontVariant: ['tabular-nums'] }, track: { height: 4, backgroundColor: 'rgba(255,255,255,0.3)' } });
