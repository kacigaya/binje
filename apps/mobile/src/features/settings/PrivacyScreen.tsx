import { StyleSheet, Text, useColorScheme } from 'react-native';
import { Screen } from '../../components/Screen';
import { useLocale } from '../../providers/LocaleProvider';
import { colors, spacing, typography } from '../../theme';
export default function PrivacyScreen() {
  useColorScheme();
  const { t } = useLocale();
  return <Screen title={t('privacyPolicy')}>
    <Text accessibilityRole="header" style={styles.heading}>{t('privacyDataTitle')}</Text>
    <Text selectable style={styles.body}>{t('privacyDataBody')}</Text>
    <Text accessibilityRole="header" style={styles.heading}>{t('privacyTrackingTitle')}</Text>
    <Text selectable style={styles.body}>{t('privacyTrackingBody')}</Text>
    <Text accessibilityRole="header" style={styles.heading}>{t('privacyControlsTitle')}</Text>
    <Text selectable style={styles.body}>{t('privacyControlsBody')}</Text>
  </Screen>;
}
const styles = StyleSheet.create({ heading: { ...typography.heading, color: colors.text, paddingHorizontal: spacing.md, marginTop: spacing.lg }, body: { ...typography.body, color: colors.muted, paddingHorizontal: spacing.md, marginTop: spacing.sm } });
