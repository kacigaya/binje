import { ActivityIndicator, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useLocale } from '../providers/LocaleProvider';
import { Button } from './Button';
import { colors, spacing, typography } from '../theme';
export function LoadingState() {
  const { t } = useLocale();
  useColorScheme();
  return <View style={styles.box} accessibilityLabel={t('loading')} accessibilityRole="progressbar"><ActivityIndicator color={colors.accent} /></View>;
}
export function EmptyState({ title, body, actionLabel, onAction }: { title: string; body?: string; actionLabel?: string; onAction?: () => void }) {
  useColorScheme();
  return <View style={styles.box}><Text selectable style={styles.title}>{title}</Text>{body ? <Text selectable style={styles.body}>{body}</Text> : null}{actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}</View>;
}
export function ErrorState({ title, body, onRetry }: { title?: string; body?: string; onRetry?: () => void }) {
  const { t } = useLocale();
  useColorScheme();
  return <View style={styles.box} accessibilityRole="alert" accessibilityLiveRegion="polite"><Text selectable style={styles.title}>{title ?? t('errorTitle')}</Text><Text selectable style={styles.body}>{body ?? t('errorBody')}</Text>{onRetry ? <Button label={t('retry')} onPress={onRetry} /> : null}</View>;
}
const styles = StyleSheet.create({ box: { padding: spacing.lg, gap: spacing.md }, title: { ...typography.heading, color: colors.text }, body: { ...typography.body, color: colors.muted } });
