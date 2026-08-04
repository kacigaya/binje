"use client";

import { useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { DEFAULT_LOCALE, isLocale, translate } from "@/lib/i18n";

export function useLocale() {
  const value = useParams<{ locale?: string }>().locale ?? DEFAULT_LOCALE;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function useTranslations() {
  const locale = useLocale();
  const t = useCallback(
    (text: Parameters<typeof translate>[1]) => translate(locale, text),
    [locale],
  );
  return useMemo(() => ({ locale, t }), [locale, t]);
}
