import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { RefreshControl, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { getHome } from '../../api/media';
import { useLocale } from '../../providers/LocaleProvider';
import { Screen } from '../../components/Screen';
import { TmdbRating, RtRating } from '../../components/Badges';
import { Button } from '../../components/Button';
import { ContinueWatching } from '../../components/ContinueWatching';
import { MediaRow } from '../../components/MediaRow';
import { ErrorState, LoadingState, EmptyState } from '../../components/States';
import { colors, spacing, typography } from '../../theme';

export default function HomeScreen() {
  useColorScheme();
  const { locale, t } = useLocale();
  const q = useQuery({ queryKey: ['home', locale], queryFn: ({ signal }) => getHome(locale, signal) });
  if (!q.data) return <Screen title={t('home')}>{q.isError ? <ErrorState onRetry={() => void q.refetch()} /> : <LoadingState />}</Screen>;
  const hero = q.data.featured[0];
  return <Screen title={t('home')} refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />}>
    {q.isError ? <ErrorState body={t('refreshFailed')} onRetry={() => void q.refetch()} /> : null}
    {hero ? <>
      {hero.backdropUrl ? <Image source={hero.backdropUrl} alt={hero.title} style={{ width: '100%', aspectRatio: 16 / 9 }} contentFit="cover" /> : null}
      <View style={styles.copy}>
        <Text accessibilityRole="header" style={styles.title}>{hero.title}</Text>
        <View style={styles.meta}><TmdbRating rating={hero.rating.toFixed(1)} />{hero.rottenTomatoesScore != null ? <RtRating score={hero.rottenTomatoesScore} /> : null}<Text style={styles.body}>{hero.date.slice(0, 4)}</Text></View>
        <Text style={styles.body}>{hero.overview}</Text>
        <Button label={t('watchNow')} onPress={() => router.push(`/watch/${hero.mediaType}/${hero.id}`)} />
        <Button secondary label={t('details')} onPress={() => router.push(`/${hero.mediaType}/${hero.id}`)} />
      </View>
    </> : null}
    <ContinueWatching />
    <MediaRow title={t('trendingMovies')} items={q.data.trendingMovies} />
    <MediaRow title={t('trendingTV')} items={q.data.trendingTV} />
    {!hero && !q.data.trendingMovies.length && !q.data.trendingTV.length ? <EmptyState title={t('noResults')} actionLabel={t('browse')} onAction={() => router.push('/browse')} /> : null}
  </Screen>;
}
const styles = StyleSheet.create({ copy: { padding: spacing.md, gap: spacing.md }, title: { ...typography.title, color: colors.text }, body: { ...typography.body, color: colors.muted }, meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md } });
