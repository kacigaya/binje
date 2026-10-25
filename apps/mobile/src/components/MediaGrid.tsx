import { FlatList, View, useWindowDimensions } from 'react-native';
import type { ReactNode } from 'react';
import type { MobileMediaSummary } from '../types/api';
import { MediaCard } from './MediaCard';
import { spacing } from '../theme';

export function gridLayout(width: number, fontScale = 1) {
  const columns = Math.max(1, Math.floor((width - spacing.md) / (160 * Math.max(1, fontScale))));
  return { columns, cardWidth: Math.max(1, (width - spacing.md * (columns + 1)) / columns) };
}
export function MediaGrid({ items, header, footer, empty, refreshing = false, onRefresh, onEndReached }: {
  items: MobileMediaSummary[]; header?: ReactNode; footer?: ReactNode; empty?: ReactNode;
  refreshing?: boolean; onRefresh?: () => void; onEndReached?: () => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  const { columns, cardWidth } = gridLayout(width, fontScale);
  return <FlatList key={columns} data={items} numColumns={columns} style={{ flex: 1 }}
    contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
    refreshing={refreshing} onRefresh={onRefresh} onEndReached={onEndReached} onEndReachedThreshold={0.3}
    keyExtractor={item => `${item.mediaType}-${item.id}`}
    renderItem={({ item }) => <View style={{ width: cardWidth, marginLeft: spacing.md, marginBottom: spacing.md }}><MediaCard item={item} width={cardWidth} /></View>}
    contentContainerStyle={{ flexGrow: 1, paddingBottom: spacing.lg }}
    ListHeaderComponent={<>{header}</>} ListFooterComponent={<>{footer}</>} ListEmptyComponent={<>{empty}</>} />;
}
