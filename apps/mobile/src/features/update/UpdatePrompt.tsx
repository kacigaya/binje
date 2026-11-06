import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { getLatestRelease } from '../../api/media';
import { Button } from '../../components/Button';
import { useLocale } from '../../providers/LocaleProvider';
import { getConsent } from '../../storage/consent';
import { getPreferences, setDismissedUpdate } from '../../storage/preferences';
import { colors, fonts, spacing } from '../../theme';
import { isNewerVersion, updateUrl } from './updateCheck';

/**
 * Offers the latest GitHub release once per version. The b!nje server reads GitHub, so the app contacts no other service.
 * It waits while the consent sheet is open: a fresh install answers that first and sees this on a later launch.
 */
export function UpdatePrompt() {
  const { t } = useLocale();
  const installed = Constants.expoConfig?.version;
  const [ready, setReady] = useState<{ dismissed?: string } | null>(null);
  const [closed, setClosed] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void Promise.all([getConsent(), getPreferences()]).then(([consent, preferences]) => {
      if (active && consent !== null) setReady({ dismissed: preferences.dismissedUpdate });
    });
    return () => { active = false; };
  }, []);
  const release = useQuery({
    queryKey: ['latestRelease'],
    queryFn: ({ signal }) => getLatestRelease(signal),
    enabled: ready !== null && Platform.OS !== 'web' && installed !== undefined,
    staleTime: Infinity,
    retry: false,
  });
  const latest = release.data;
  if (closed || !latest || !installed || ready?.dismissed === latest.version || !isNewerVersion(latest.version, installed)) return null;
  const url = updateUrl(latest, { os: Platform.OS, isTV: Platform.isTV });
  const later = () => {
    setClosed(true);
    // Failing to save only means the prompt returns on the next launch.
    void setDismissedUpdate(latest.version).catch(() => {});
  };
  const update = async () => {
    try { await Linking.openURL(url); setClosed(true); }
    catch { setOpenFailed(true); }
  };

  return <Modal visible transparent animationType="fade" accessibilityViewIsModal onRequestClose={later}>
    <View style={s.overlay}><View style={s.card}>
      <Text accessibilityRole="header" style={s.title}>{t('updateTitle')}</Text>
      <Text style={s.body}>{t('updateBody').replace('{version}', latest.version).replace('{installed}', installed)}</Text>
      {/* A TV without a browser cannot open the link; the address can go into a downloader app. */}
      {openFailed ? <Text accessibilityRole="alert" selectable style={s.error}>{t('updateOpenFailed')} {url}</Text> : null}
      <View style={s.actions}>
        <Button label={t('later')} secondary onPress={later} />
        <Button hasTVPreferredFocus label={t('update')} onPress={() => void update()} />
      </View>
    </View></View>
  </Modal>;
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000b', justifyContent: 'flex-end' },
  card: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, gap: spacing.md },
  title: { color: colors.text, fontSize: 22, fontFamily: fonts.heading },
  body: { color: colors.muted, fontSize: 16, lineHeight: 23, fontFamily: fonts.body },
  error: { color: colors.destructive, fontSize: 14, lineHeight: 20, fontFamily: fonts.body },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});
