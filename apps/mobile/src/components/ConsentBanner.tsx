import { BottomSheet, RNHostView } from '@expo/ui';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View, useColorScheme } from 'react-native';
import { getConsent, setConsent, subscribeToConsent, type Consent } from '../storage/consent';
import { useLocale } from '../providers/LocaleProvider';
import { Button } from './Button';
import { colors, spacing, typography } from '../theme';

export function ConsentBanner() {
  useColorScheme();
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const busy = useRef(false);
  useEffect(() => {
    let active = true;
    const load = () => void getConsent().then(value => { if (active) setVisible(value === null); });
    load();
    const unsubscribe = subscribeToConsent(load);
    return () => { active = false; unsubscribe(); };
  }, []);
  async function choose(value: Consent) {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(false);
    try { await setConsent(value); setVisible(false); }
    catch { setError(true); setVisible(true); }
    finally { busy.current = false; setSaving(false); }
  }
  return <BottomSheet isPresented={visible} onDismiss={() => { setVisible(false); void choose('dismissed'); }}
    containerColor={colors.surface} contentPadding={spacing.lg} snapPoints={['half', 'full']}>
    <RNHostView><ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.lg }}>
      <Text accessibilityRole="header" style={{ ...typography.heading, color: colors.text }}>{t('consentTitle')}</Text>
      <Text style={{ ...typography.body, color: colors.text }}>{t('consentBody')}</Text>
      {error ? <Text accessibilityRole="alert" style={{ color: colors.destructive }}>{t('saveFailed')}</Text> : null}
      <View style={{ gap: spacing.sm }}>
        <Button label={t('accept')} disabled={saving} onPress={() => void choose('accepted')} />
        <Button label={t('dismiss')} secondary disabled={saving} onPress={() => void choose('dismissed')} />
      </View>
    </ScrollView></RNHostView>
  </BottomSheet>;
}
