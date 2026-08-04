import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Toaster } from "sonner";
import { Space_Grotesk, Outfit } from "next/font/google";
import "../globals.css";
import Navbar from "@/components/Navbar";
import CommandMenu from "@/components/CommandMenu";
import Footer from "@/components/Footer";
import CookiesBanner from "@/components/CookiesBanner";
import { isLocale, translate } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";

const heading = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const body = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export function generateStaticParams() {
  return [{ locale: "en" }, { locale: "fr" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const description = translate(
    locale,
    "Discover and stream thousands of movies. Your cinematic journey starts here.",
  );
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: "b!nje", template: "%s | b!nje" },
    description,
    alternates: { canonical: `/${locale}` },
    openGraph: {
      type: "website",
      siteName: "b!nje",
      title: "b!nje",
      description,
      url: `/${locale}`,
      locale: locale === "fr" ? "fr_FR" : "en_US",
    },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport = {
  themeColor: "#050506",
};

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <html lang={locale} className={`${heading.variable} ${body.variable} dark`}>
      <head>
        <link rel="preconnect" href="https://image.tmdb.org" />
        <link rel="dns-prefetch" href="https://image.tmdb.org" />
      </head>
      <body className="min-h-dvh flex flex-col bg-background text-foreground antialiased">
        <Navbar />
        <CommandMenu />
        <main className="flex-1">{children}</main>
        <Footer />
        <CookiesBanner />
        <Toaster
          position="bottom-center"
          theme="dark"
          style={{ fontFamily: "var(--font-sans)" }}
          toastOptions={{
            unstyled: true,
            classNames: {
              toast:
                "flex w-full items-center gap-3 rounded-[2rem] border border-white/10 bg-background/50 px-5 py-4 shadow-lg shadow-black/30 backdrop-blur-xl",
              title: "text-sm font-semibold text-foreground",
              description: "text-xs text-muted-foreground",
              icon: "flex shrink-0 items-center text-accent-red [&_svg]:size-5",
              actionButton:
                "ml-auto shrink-0 rounded-full bg-accent-red px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-red/90 cursor-pointer",
              closeButton:
                "rounded-full border border-white/10 bg-white/8 text-muted-foreground hover:text-foreground",
            },
          }}
        />
      </body>
    </html>
  );
}
