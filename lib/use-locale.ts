"use client";

import { useParams } from "next/navigation";
import { DEFAULT_LOCALE, isLocale, translate } from "@/lib/i18n";

export function useLocale() {
  const value = useParams<{ locale?: string }>().locale ?? DEFAULT_LOCALE;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function useTranslations() {
  const locale = useLocale();
  return { locale, t: (text: Parameters<typeof translate>[1]) => translate(locale, text) };
}
