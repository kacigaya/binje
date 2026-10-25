import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { browseMedia, type BrowseCategory } from '../../api/media';
import type { MobileMediaType } from '../../types/api';
import type { TranslationKey } from '../../i18n';
import { useLocale } from '../../providers/LocaleProvider';
import { Screen } from '../../components/Screen';
import { MediaGrid } from '../../components/MediaGrid';
import { Choice } from '../../components/Choice';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { colors } from '../../theme';
const categories: BrowseCategory[] = ['popular', 'top-rated', 'now-playing', 'upcoming', 'airing-today', 'on-the-air'];
const categoryKeys: Record<BrowseCategory, TranslationKey> = { trending: 'trending', popular: 'popular', 'top-rated': 'topRated', 'now-playing': 'nowPlaying', upcoming: 'upcoming', 'airing-today': 'airingToday', 'on-the-air': 'onTheAir' };
export default function BrowseScreen() {
  const { locale, t } = useLocale();
  const [type, setType] = useState<MobileMediaType>('movie');
  const [category, setCategory] = useState<BrowseCategory>('popular');
  const q = useInfiniteQuery({ queryKey: ['browse', type, category, locale], initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => browseMedia(type, category, pageParam, locale, signal),
    getNextPageParam: last => last.items.length ? last.page + 1 : undefined });
  const seen = new Set<string>();
  const items = (q.data?.pages.flatMap(page => page.items) ?? []).filter(item => {
    const key = `${item.mediaType}-${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  return <Screen scroll={false} title={t('browse')}>
    <MediaGrid items={items} refreshing={q.isRefetching && !q.isFetchingNextPage} onRefresh={() => void q.refetch()}
      header={<>
        <Choice label={t('browse')} value={type} options={[{ value: 'movie', label: t('movies') }, { value: 'tv', label: t('tvShows') }]}
          onChange={value => { setType(value); setCategory('popular'); }} />
        <Choice label={t('category')} value={category} onChange={setCategory}
          options={categories.filter(value => type === 'movie' ? !['airing-today', 'on-the-air'].includes(value) : !['now-playing', 'upcoming'].includes(value)).map(value => ({ value, label: t(categoryKeys[value]) }))} />
        {q.isError && q.data && !q.isFetchNextPageError ? <ErrorState body={t('refreshFailed')} onRetry={() => void q.refetch()} /> : null}
      </>}
      empty={q.isLoading ? <LoadingState /> : q.isError ? <ErrorState onRetry={() => void q.refetch()} /> : <EmptyState title={t('noResults')} body={t('browseEmptyBody')} />}
      footer={q.isFetchingNextPage ? <ActivityIndicator color={colors.accent} /> : q.isFetchNextPageError ? <ErrorState onRetry={() => void q.fetchNextPage()} /> : null}
      onEndReached={() => { if (q.hasNextPage && !q.isFetching && !q.isFetchNextPageError) void q.fetchNextPage(); }} />
  </Screen>;
}
