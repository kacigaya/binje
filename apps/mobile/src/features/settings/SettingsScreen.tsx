import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useLocale } from '../../providers/LocaleProvider';
import { usePlayHistory } from '../../hooks/usePlayHistory';
import { getConsent, setConsent, subscribeToConsent, type Consent } from '../../storage/consent';
import { Screen } from '../../components/Screen';
import { colors, fonts, spacing } from '../../theme';

export default function SettingsScreen() {
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
  return <Screen title={t('settings')}>
    <Section title={t('language')}>
      <Row kind="radio" label={t('english')} selected={locale === 'en'} disabled={pending || loading} onPress={() => void save(() => setLocale('en'))} />
      <Row kind="radio" label={t('french')} selected={locale === 'fr'} disabled={pending || loading} onPress={() => void save(() => setLocale('fr'))} />
    </Section>
    <Section title={t('privacy')}>
      <Row kind="switch" label={t('allowStorage')} selected={consent === 'accepted'} disabled={pending || loading} onPress={() => void save(() => setConsent(consent === 'accepted' ? 'dismissed' : 'accepted'))} />
      <Row kind="link" label={t('privacyPolicy')} onPress={() => router.push('/privacy')} />
      <Row kind="action" label={t('clearHistory')} destructive disabled={pending || loading} onPress={() => Alert.alert(t('clearHistory'), t('clearHistoryBody'), [
        { text: t('dismiss'), style: 'cancel' },
        { text: t('clearHistory'), style: 'destructive', onPress: () => void save(history.clear) },
      ])} />
      {error ? <Text accessibilityRole="alert" style={{ color: colors.destructive, padding: spacing.md, fontFamily: fonts.body }}>{error}</Text> : null}
    </Section>
  </Screen>;
}
type RowKind = 'radio' | 'switch' | 'link' | 'action';
function Section({title,children}:{title:string;children:React.ReactNode}){return <View style={s.section}><Text accessibilityRole="header" style={s.heading}>{title}</Text><View style={s.card}>{children}</View></View>}
function Row({kind,label,onPress,selected=false,destructive,disabled}:{kind:RowKind;label:string;onPress:()=>void;selected?:boolean;destructive?:boolean;disabled?:boolean}){
  const role=kind==='radio'?'radio':kind==='switch'?'switch':kind==='link'?'link':'button';
  const state=kind==='radio'?{checked:selected,disabled}:kind==='switch'?{checked:selected,disabled}:{disabled};
  return <Pressable accessibilityRole={role} accessibilityState={state} disabled={disabled} onPress={onPress} style={({pressed})=>[s.row,pressed&&s.rowPressed]}>
    <Text style={[s.label,destructive&&s.destructive]}>{label}</Text>
    {kind==='radio'&&selected?<Feather name="check" size={20} color={colors.accent}/>:null}
    {kind==='link'?<Feather name="chevron-right" size={20} color={colors.muted}/>:null}
    {/* Screen readers reach the switch through the row, which carries its role and state. */}
    {kind==='switch'?<Switch value={selected} disabled={disabled} onValueChange={onPress} trackColor={{false:colors.surfaceAlt,true:colors.accent}} thumbColor={colors.text} ios_backgroundColor={colors.surfaceAlt} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"/>:null}
  </Pressable>;
}
const s=StyleSheet.create({section:{paddingHorizontal:spacing.md,marginTop:spacing.lg,gap:8},heading:{color:colors.muted,fontFamily:fonts.bodySemiBold,textTransform:'uppercase',fontSize:12,letterSpacing:1},card:{backgroundColor:colors.surface,borderRadius:14,borderCurve:'continuous',borderWidth:1,borderColor:colors.border,overflow:'hidden'},row:{minHeight:54,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:spacing.md,borderBottomWidth:StyleSheet.hairlineWidth,borderColor:colors.border},rowPressed:{backgroundColor:colors.fillActive},label:{flexShrink:1,color:colors.text,fontSize:16,fontFamily:fonts.body},destructive:{color:colors.destructive}});
