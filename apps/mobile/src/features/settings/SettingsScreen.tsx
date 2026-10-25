import { FieldGroup, Host, ListItem, Switch, Text as NativeText } from '@expo/ui';
import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, useColorScheme } from 'react-native';
import { useLocale } from '../../providers/LocaleProvider';
import { usePlayHistory } from '../../hooks/usePlayHistory';
import { getConsent, setConsent, subscribeToConsent, type Consent } from '../../storage/consent';
import { NativePicker } from '../../components/NativePicker';
import { colors } from '../../theme';

export default function SettingsScreen() {
  const scheme = useColorScheme();
  const { locale, setLocale, t } = useLocale();
  const history = usePlayHistory();
  const [consent, setConsentState] = useState<Consent | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  useEffect(() => {
    let active = true;
    const load = () => void getConsent().then(value => { if (active) { setConsentState(value); setLoading(false); } });
    load();
    const unsubscribe = subscribeToConsent(load);
    return () => { active = false; unsubscribe(); };
  }, []);
  async function save(action: () => Promise<unknown>) {
    if (busy.current) return;
    busy.current = true; setPending(true); setError('');
    try { if (await action() === false) setError(t('storageRequired')); }
    catch { setError(t('saveFailed')); }
    finally { busy.current = false; setPending(false); }
  }
  return <>
    <Stack.Screen options={{ title: t('settings') }} />
    <Host style={{ flex: 1 }} colorScheme={scheme} seedColor={colors.accent}>
      <FieldGroup disabled={pending || loading}>
        <FieldGroup.Section title={t('language')}>
          <NativePicker label={t('language')} value={locale} disabled={pending}
            onChange={value => void save(() => setLocale(value))}
            options={[{ value: 'en', label: t('english') }, { value: 'fr', label: t('french') }]} />
        </FieldGroup.Section>
        <FieldGroup.Section title={t('privacy')}>
          <Switch label={t('allowStorage')} value={consent === 'accepted'} disabled={loading || pending}
            onValueChange={value => void save(() => setConsent(value ? 'accepted' : 'dismissed'))} />
          <ListItem onPress={pending ? undefined : () => router.push('/privacy')}>{t('privacyPolicy')}</ListItem>
          <ListItem onPress={pending ? undefined : () => Alert.alert(t('clearHistory'), t('clearHistoryBody'), [
            { text: t('dismiss'), style: 'cancel' },
            { text: t('clearHistory'), style: 'destructive', onPress: () => void save(history.clear) },
          ])}>{t('clearHistory')}</ListItem>
          {error ? <FieldGroup.SectionFooter><NativeText>{error}</NativeText></FieldGroup.SectionFooter> : null}
        </FieldGroup.Section>
      </FieldGroup>
    </Host>
  </>;
}
