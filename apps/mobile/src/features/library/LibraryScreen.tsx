import { router } from 'expo-router';
import { useState } from 'react';
import { useWatchlist } from '../../hooks/useWatchlist';
import { usePlayHistory } from '../../hooks/usePlayHistory';
import { useLocale } from '../../providers/LocaleProvider';
import { Screen } from '../../components/Screen';
import { MediaGrid } from '../../components/MediaGrid';
import { Choice } from '../../components/Choice';
import { EmptyState, LoadingState } from '../../components/States';
export default function LibraryScreen() {
  const [tab, setTab] = useState<'watchlist' | 'history'>('watchlist');
  const w = useWatchlist(); const h = usePlayHistory(); const { t } = useLocale();
  const items = (tab === 'watchlist' ? w.items : h.items).map(item => ({ id: item.id, mediaType: item.type, title: item.title, overview: '', posterUrl: item.poster_path, backdropUrl: item.backdrop_path, date: item.date, rating: item.vote_average }));
  return <Screen scroll={false} title={t('library')}>
    <MediaGrid items={items} header={<Choice label={t('library')} value={tab} onChange={setTab} options={[{ value: 'watchlist', label: t('myWatchlist') }, { value: 'history', label: t('continueWatching') }]} />}
      empty={w.isLoading || h.isLoading ? <LoadingState /> : <EmptyState title={tab === 'watchlist' ? t('emptyWatchlist') : t('noResults')} actionLabel={t('browse')} onAction={() => router.push('/browse')} />} />
  </Screen>;
}
