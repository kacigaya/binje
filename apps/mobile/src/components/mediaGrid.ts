import { Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { screenPadding, spacing, layout } from '../theme';

export function gridColumnCount(width: number) {
  return Platform.isTV ? Math.max(2, Math.min(6, Math.floor((width - 96) / 150))) : 2;
}

export function useGridColumns() {
  return gridColumnCount(useWindowDimensions().width);
}

export function useGridCardWidth() {
  const { width } = useWindowDimensions();
  const columns = gridColumnCount(width);
  return Math.floor((width - (Platform.isTV ? layout.tvRailWidth : 0) - screenPadding * 2 - spacing.md * (columns - 1)) / columns);
}

export const gridStyles = StyleSheet.create({
  content: { paddingHorizontal: screenPadding, paddingBottom: spacing.xl, gap: spacing.lg },
  row: { gap: spacing.md },
});
