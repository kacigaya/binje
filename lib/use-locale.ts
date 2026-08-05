"use client";

import { useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { localeOrDefault, translate } from "@/lib/i18n";

export function useLocale() {
  return localeOrDefault(useParams<{ locale?: string }>().locale ?? null);
}

export function useTranslations() {
  const locale = useLocale();
  const t = useCallback(
    (text: Parameters<typeof translate>[1]) => translate(locale, text),
    [locale],
  );
  return useMemo(() => ({ locale, t }), [locale, t]);
}
