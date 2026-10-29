import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { getMediaDetails, getSeason } from '../../api/media';
import { BackButton } from '../../components/BackButton';
import { RtRating, TmdbRating } from '../../components/Badges';
import { Button } from '../../components/Button';
import { MediaRow } from '../../components/MediaRow';
import { Screen } from '../../components/Screen';
import { DetailsSkeleton } from '../../components/Skeletons';
import { ErrorState } from '../../components/States';
import { useIsInWatchlist, useWatchlistToggle } from '../../hooks/useWatchlistToggle';
import { formatRating } from '../../i18n/format';
import { useLocale } from '../../providers/LocaleProvider';
import { colors, fonts, radius, spacing } from '../../theme';
import type { MobileMediaType, MobilePerson, MobileSeason } from '../../types/api';

type FeatherName = ComponentProps<typeof Feather>['name'];

function formatRuntime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h ${m} m` : `${m} m`;
}

function Meta({ icon, children }: { icon: FeatherName; children: ReactNode }) {
  return (
    <View style={s.metaItem}>
      <Feather name={icon} size={15} color={colors.muted} />
      <Text style={s.metaText}>{children}</Text>
    </View>
  );
}

function CastCard({ person }: { person: MobilePerson }) {
  return (
    <View style={s.castCard}>
      <View style={s.castPhoto}>
        {person.profileUrl ? (
          <Image source={person.profileUrl} alt={person.name} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        ) : (
          <Text style={s.castInitial}>{person.name.charAt(0)}</Text>
        )}
      </View>
      <Text numberOfLines={1} style={s.castName}>{person.name}</Text>
      <Text numberOfLines={1} style={s.castRole}>{person.role}</Text>
    </View>
  );
}

/** Mirrors the web SeasonEpisodes section: season chips above a list of episodes. */
function Episodes({ showId, seasons }: { showId: number; seasons: MobileSeason[] }) {
  const { locale, t } = useLocale();
  const [season, setSeason] = useState(seasons[0].seasonNumber);
  const q = useQuery({ queryKey: ['season', showId, season, locale], queryFn: ({ signal }) => getSeason(showId, season, locale, signal) });
  const dateFormat = new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <View style={s.section}>
      <Text accessibilityRole="header" style={s.sectionTitle}>{t('episodes')}</Text>
      {seasons.length > 1 ? (
        <View style={s.chips}>
          {seasons.map((item) => {
            const active = item.seasonNumber === season;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setSeason(item.seasonNumber)}
                style={({ pressed }) => [s.chip, active && s.chipActive, pressed && !active && s.chipPressed]}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>{item.name}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {q.isLoading ? (
        <View style={s.episodeList}>{[0, 1, 2].map((i) => <View key={i} style={s.episodeSkeleton} />)}</View>
      ) : q.isError && !q.data ? (
        <ErrorState body={t('errorBody')} onRetry={() => void q.refetch()} />
      ) : !q.data?.episodes.length ? (
        <Text style={s.metaText}>{t('noEpisodes')}</Text>
      ) : (
        <View style={s.episodeList}>
          {q.data.episodes.map((episode) => {
            const rating = formatRating(locale, episode.rating);
            return (
              <Pressable
                key={episode.id}
                accessibilityRole="button"
                accessibilityLabel={`${episode.episodeNumber}. ${episode.name}`}
                onPress={() => router.push(`/watch/tv/${showId}?season=${season}&episode=${episode.episodeNumber}` as never)}
                style={({ pressed }) => [s.episode, pressed && s.episodePressed]}
              >
                <View style={s.still}>
                  {episode.stillUrl ? (
                    <Image source={episode.stillUrl} alt="" style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                  ) : (
                    <Text style={s.noPreview}>{t('noPreview')}</Text>
                  )}
                </View>
                <View style={s.episodeInfo}>
                  <Text numberOfLines={1} style={s.episodeTitle}>{episode.episodeNumber}. {episode.name}</Text>
                  <View style={s.episodeMeta}>
                    {episode.airDate ? <Text style={s.episodeMetaText}>{dateFormat.format(new Date(episode.airDate))}</Text> : null}
                    {rating ? <TmdbRating rating={rating} compact /> : null}
                  </View>
                  {episode.overview ? <Text numberOfLines={2} style={s.episodeOverview}>{episode.overview}</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default function DetailsScreen({ type, id }: { type: MobileMediaType; id: number }) {
  const { locale, t } = useLocale();
  const [error, setError] = useState('');
  const saved = useIsInWatchlist({ type, id });
  const { setSaved, pending } = useWatchlistToggle(setError);
  const q = useQuery({
    queryKey: ['details', type, id, locale],
    queryFn: ({ signal }) => getMediaDetails(type, id, locale, signal),
    enabled: Number.isInteger(id) && id > 0,
  });

  if (q.isLoading) return <Screen overlay={<BackButton />}><DetailsSkeleton /></Screen>;
  if (!q.data) return <Screen overlay={<BackButton />}><View style={s.errorBox}><ErrorState onRetry={() => void q.refetch()} /></View></Screen>;

  const d = q.data;
  const input = { type, id, title: d.title, poster_path: d.posterUrl, backdrop_path: d.backdropUrl, date: d.date, vote_average: d.rating };
  const releaseDate = d.date
    ? new Date(d.date).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;
  const seasons = d.seasons.filter((x) => x.seasonNumber > 0);
  const episodeCount = seasons.reduce((sum, x) => sum + x.episodeCount, 0);
  const rating = formatRating(locale, d.rating) ?? t('notAvailable');

  function toggle() {
    setError('');
    void setSaved(input, !saved);
  }

  return (
    <Screen overlay={<BackButton />}>
      {q.isError ? <ErrorState body={t('refreshFailed')} onRetry={() => void q.refetch()} /> : null}
      <View style={s.hero}>
        {d.backdropUrl ? <Image source={d.backdropUrl} alt="" style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" /> : null}
        <LinearGradient colors={['rgba(5,5,6,0.2)', 'rgba(5,5,6,0.6)', colors.background]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      </View>
      <View style={s.content}>
        <View style={s.headRow}>
          <View style={s.poster}>
            {d.posterUrl ? <Image source={d.posterUrl} alt="" style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          </View>
          <View style={s.headInfo}>
            {d.logoUrl ? (
              <Image source={d.logoUrl} alt={d.title} accessibilityRole="header" style={s.logo} contentFit="contain" contentPosition="left bottom" />
            ) : (
              <Text accessibilityRole="header" style={s.title}>{d.title}</Text>
            )}
            {d.tagline ? <Text style={s.tagline}>{d.tagline}</Text> : null}
          </View>
        </View>

        <View style={s.metaRow}>
          <TmdbRating rating={rating} />
          {d.rottenTomatoesScore != null ? <RtRating score={d.rottenTomatoesScore} /> : null}
          {d.contentRating ? <View style={s.rated}><Text style={s.ratedText}>{d.contentRating}</Text></View> : null}
          {type === 'tv' && seasons.length ? <Meta icon="layers">{seasons.length} {seasons.length === 1 ? t('season') : t('seasons')}</Meta> : null}
          {type === 'tv' && episodeCount ? <Meta icon="tv">{episodeCount} {episodeCount === 1 ? t('episode') : t('episodes')}</Meta> : null}
          {d.runtime ? <Meta icon="clock">{formatRuntime(d.runtime)}</Meta> : null}
          {releaseDate ? <Meta icon="calendar">{releaseDate}</Meta> : null}
        </View>

        {d.genres.length ? (
          <View style={s.genres}>
            {d.genres.map((g) => <View key={g.id} style={s.genre}><Text style={s.genreText}>{g.name}</Text></View>)}
          </View>
        ) : null}

        <View style={s.actions}>
          <Button label={t('watchNow')} icon={<Ionicons name="play" size={18} color={colors.text} />} onPress={() => router.push(`/watch/${type}/${id}` as never)} />
          <Button secondary icon={<Feather name={saved ? 'check' : 'plus'} size={18} color={colors.text} />} label={saved ? t('removeFromWatchlist') : t('addToWatchlist')} loading={pending} onPress={toggle} />
        </View>
        {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}

        <View style={s.separator} />

        <View style={s.block}>
          <Text accessibilityRole="header" style={s.heading}>{t('overview')}</Text>
          <Text selectable style={s.body}>{d.overview}</Text>
        </View>
        {d.creators.length ? (
          <View>
            <Text style={s.creatorsLabel}>{type === 'movie' ? t('director') : t('createdBy')}</Text>
            <Text style={s.creatorsNames}>{d.creators.map((p) => p.name).join(', ')}</Text>
          </View>
        ) : null}
      </View>

      {type === 'tv' && seasons.length ? <View style={s.padded}><Episodes showId={id} seasons={seasons} /></View> : null}

      {d.cast.length ? (
        <View style={s.section}>
          <Text accessibilityRole="header" style={[s.sectionTitle, s.padded]}>{t('cast')}</Text>
          <FlatList
            horizontal
            data={d.cast.slice(0, 12)}
            keyExtractor={(p) => String(p.id)}
            renderItem={({ item }) => <CastCard person={item} />}
            contentContainerStyle={s.castList}
            showsHorizontalScrollIndicator={false}
          />
        </View>
      ) : null}

      <MediaRow title={type === 'movie' ? t('similarMovies') : t('similarShows')} items={d.related} />
    </Screen>
  );
}

const s = StyleSheet.create({
  errorBox: { flex: 1, justifyContent: 'center' },
  hero: { height: 260, backgroundColor: colors.surface },
  content: { paddingHorizontal: spacing.md, gap: 20 },
  padded: { paddingHorizontal: spacing.md },
  headRow: { flexDirection: 'row', gap: spacing.md, marginTop: -96, alignItems: 'flex-end' },
  poster: {
    width: 104,
    height: 156,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    boxShadow: '0 16px 32px rgba(0,0,0,0.5)',
  },
  headInfo: { flex: 1, gap: spacing.sm },
  logo: { width: '100%', height: 64 },
  title: { color: colors.text, fontSize: 24, fontFamily: fonts.heading, letterSpacing: -0.5, lineHeight: 30 },
  tagline: { color: colors.muted, fontStyle: 'italic', fontSize: 14, fontFamily: fonts.body },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: spacing.md, rowGap: spacing.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaText: { color: colors.muted, fontSize: 14, fontFamily: fonts.body, fontVariant: ['tabular-nums'] },
  rated: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 6, paddingHorizontal: 6 },
  ratedText: { color: 'rgba(240,240,240,0.8)', fontSize: 12, fontFamily: fonts.bodySemiBold },
  genres: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  genre: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  genreText: { color: 'rgba(240,240,240,0.8)', fontSize: 12, fontFamily: fonts.body },
  actions: { gap: 12 },
  error: { color: colors.destructive, fontFamily: fonts.body },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.1)' },
  block: { gap: spacing.sm },
  heading: { color: colors.text, fontSize: 18, fontFamily: fonts.heading },
  body: { color: 'rgba(240,240,240,0.7)', fontSize: 16, lineHeight: 26, fontFamily: fonts.body },
  creatorsLabel: { color: colors.muted, fontSize: 14, fontFamily: fonts.body },
  creatorsNames: { color: colors.text, fontSize: 16, fontFamily: fonts.bodyMedium, marginTop: 2 },
  section: { marginTop: 48, gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 20, fontFamily: fonts.heading },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipPressed: { backgroundColor: colors.fillActive },
  chipText: { color: colors.text, fontSize: 14, fontFamily: fonts.bodyMedium },
  chipTextActive: { color: colors.background },
  episodeList: { gap: spacing.sm },
  episodeSkeleton: { height: 80, borderRadius: radius.md, backgroundColor: colors.fill },
  episode: { flexDirection: 'row', gap: 12, padding: spacing.xs, borderRadius: radius.md, borderCurve: 'continuous' },
  episodePressed: { backgroundColor: colors.fill },
  still: { width: 128, aspectRatio: 16 / 9, borderRadius: radius.sm, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  noPreview: { color: colors.muted, fontSize: 11, fontFamily: fonts.body },
  episodeInfo: { flex: 1, gap: 2 },
  episodeTitle: { color: colors.text, fontSize: 14, fontFamily: fonts.bodySemiBold },
  episodeMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  episodeMetaText: { color: colors.muted, fontSize: 12, fontFamily: fonts.body, fontVariant: ['tabular-nums'] },
  episodeOverview: { color: colors.muted, fontSize: 12, lineHeight: 17, fontFamily: fonts.body },
  castList: { paddingHorizontal: spacing.md, gap: 14 },
  castCard: { width: 90, alignItems: 'center' },
  castPhoto: { width: 80, height: 80, borderRadius: 40, overflow: 'hidden', backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  castInitial: { color: colors.muted, fontSize: 24, fontFamily: fonts.heading },
  castName: { color: colors.text, fontSize: 13, fontFamily: fonts.bodyMedium, textAlign: 'center' },
  castRole: { color: colors.muted, fontSize: 11, fontFamily: fonts.body, textAlign: 'center' },
});
