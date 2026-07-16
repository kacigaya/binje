import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { DEFAULT_LOCALE, resolveLocale, translate, type Locale, type TranslationKey } from '../i18n';
import { setLocalePreference } from '../storage/preferences';

type LocaleContextValue = { locale: Locale; isLoading: boolean; setLocale(locale: Locale): Promise<void>; t(key: TranslationKey): string };
const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: PropsWithChildren) {
  const [locale, updateLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [isLoading, setLoading] = useState(true);
  useEffect(() => { let active=true; resolveLocale().then(value => { if(active){updateLocale(value);setLoading(false);} }); return () => {active=false;}; }, []);
  const setLocale = useCallback(async (value: Locale) => { await setLocalePreference(value); updateLocale(value); }, []);
  const value = useMemo(() => ({ locale, isLoading, setLocale, t: (key: TranslationKey) => translate(locale, key) }), [locale, isLoading, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error('useLocale must be used within LocaleProvider');
  return value;
}
