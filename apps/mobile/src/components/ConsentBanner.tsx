import { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { getConsent, setConsent } from '../storage/consent';
import { useLocale } from '../providers/LocaleProvider';
import { Button } from './Button';
import { colors, fonts, spacing } from '../theme';

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const { t } = useLocale();
  useEffect(() => {
    let active = true;
    void getConsent().then(value => { if (active) setVisible(value === null); });
    return () => { active = false; };
  }, []);
  async function choose(value: 'accepted' | 'dismissed') {
    if (busy.current) return;
    busy.current = true; setPending(true); setError('');
    try { await setConsent(value); setVisible(false); }
    catch { setError(t('saveFailed')); }
    finally { busy.current = false; setPending(false); }
  }
  return <Modal visible={visible} transparent animationType="fade" accessibilityViewIsModal onRequestClose={() => void choose('dismissed')}>
    <View style={s.overlay}><View style={s.card}>
      <Text accessibilityRole="header" style={s.title}>{t('consentTitle')}</Text>
      <Text style={s.body}>{t('consentBody')}</Text>
      {error ? <Text accessibilityRole="alert" style={{ color: colors.destructive, fontFamily: fonts.body }}>{error}</Text> : null}
      <View style={s.actions}>
        <Button label={t('dismiss')} secondary disabled={pending} onPress={() => void choose('dismissed')} />
        <Button label={t('accept')} loading={pending} onPress={() => void choose('accepted')} />
      </View>
    </View></View>
  </Modal>;
}
const s=StyleSheet.create({overlay:{flex:1,backgroundColor:'#000b',justifyContent:'flex-end'},card:{backgroundColor:colors.surface,borderTopLeftRadius:24,borderTopRightRadius:24,padding:spacing.lg,gap:spacing.md},title:{color:colors.text,fontSize:22,fontFamily:fonts.heading},body:{color:colors.muted,fontSize:16,lineHeight:23,fontFamily:fonts.body},actions:{flexDirection:'row',justifyContent:'flex-end',gap:spacing.sm}});
