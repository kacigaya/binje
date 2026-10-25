import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { searchMedia } from '../../api/media';
import { useLocale } from '../../providers/LocaleProvider';
import type { MobileMediaSummary } from '../../types/api';
import { Screen } from '../../components/Screen';
import { MediaGrid } from '../../components/MediaGrid';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
export default function SearchScreen() {
  const { locale, t } = useLocale();
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => { const timer = setTimeout(() => setQuery(text.trim()), 250); return () => clearTimeout(timer); }, [text]);
  const enabled = text.trim().length >= 2 && query.length >= 2;
  const q = useQuery({ queryKey: ['search', query, locale], queryFn: ({ signal }) => searchMedia(query, 1, locale, signal), enabled });
  const items: MobileMediaSummary[] = enabled ? (q.data?.results ?? []).map(item => ({ id: item.id, mediaType: item.media_type, title: item.title ?? item.name ?? '', overview: item.overview ?? '', posterUrl: item.poster_path, backdropUrl: item.backdrop_path ?? null, date: item.release_date ?? item.first_air_date ?? '', rating: item.vote_average ?? 0 })) : [];
  return <Screen title={t('search')} scroll={false}>
    <Stack.SearchBar placeholder={t('searchPlaceholder')} onChangeText={event => setText(event.nativeEvent.text)}
      onCancelButtonPress={() => { setText(''); setQuery(''); }} hideWhenScrolling={false} autoCapitalize="none" />
    <MediaGrid items={items} header={enabled && q.isError && q.data ? <ErrorState body={t('refreshFailed')} onRetry={() => void q.refetch()} /> : null}
      empty={!enabled ? <EmptyState title={t('searchPrompt')} body={t('searchHint')} /> : q.isLoading ? <LoadingState /> : q.isError ? <ErrorState onRetry={() => void q.refetch()} /> : <EmptyState title={t('noResults')} body={t('searchHint')} />} />
  </Screen>;
}
