import { StyleSheet, useWindowDimensions } from 'react-native';
import { spacing } from '../theme';

/** Two-column grid card width: screen minus both gutters and the column gap, like the web grid. */
export function useGridCardWidth() {
  const { width } = useWindowDimensions();
  return Math.floor((width - spacing.md * 3) / 2);
}

export const gridStyles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: spacing.lg },
  row: { gap: spacing.md },
});
