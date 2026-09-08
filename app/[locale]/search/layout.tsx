import type { Metadata } from "next";
import { translate, type Locale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: translate(locale, "Search"),
    description: translate(locale, "Discover movies & TV shows"),
    alternates: { canonical: `/${locale}/search` },
    robots: { index: false },
  };
}

export default function SearchLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
