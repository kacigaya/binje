import type { Metadata } from "next";
import Link from "next/link";
import { translate, type Locale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: translate(locale, "Privacy Policy"),
    description: translate(locale, "How b!nje handles your data: local watch history, no tracking, no third-party cookies."),
  };
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const french = locale === "fr";
  return (
    <div className="mx-auto mt-16 max-w-2xl px-4 py-12 sm:mt-24 sm:px-6 sm:py-16">
      <h1
        className="mb-8 text-3xl font-bold tracking-tight"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {translate(locale, "Privacy Policy")}
      </h1>

      <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
        <Section title={translate(locale, "What we store")}>
          <p>
            {french ? "Nous stockons votre historique de visionnage dans le stockage local de votre navigateur" : "We store your watch history in your browser's local storage"}
            {" "}({french ? "clé" : "key"}: <Code>binje:play-history:v1</Code>){" "}
            {french ? "afin que vous puissiez reprendre votre lecture. Ces données ne quittent jamais votre appareil." : "so you can resume what you were watching. This data never leaves your device."}
          </p>
        </Section>

        <Section title={translate(locale, "What we don't do")}>
          <p>
            {french
              ? "Nous n’utilisons aucun outil d’analyse, cookie publicitaire ou technique d’identification du navigateur. Ce site ne contient aucun traceur."
              : "We don't run analytics, don't set advertising cookies, and don't fingerprint your browser. There are no trackers on this site."}
          </p>
        </Section>

        <Section title={translate(locale, "Third parties")}>
          <p>
            {french ? "Les métadonnées des films et séries proviennent de" : "Movie and TV metadata is fetched from"}{" "}
            <ExtLink href="https://www.themoviedb.org">
              The Movie Database
            </ExtLink>{" "}
            {french
              ? "via notre API côté serveur. Lorsque vous lancez une vidéo, elle est diffusée depuis des services tiers. Ces services peuvent enregistrer les requêtes ; leurs propres politiques de confidentialité s’appliquent."
              : "via our server-side API. When you press play, video is streamed from third-party embed sources. Those services may log requests on their end; their own privacy policies apply."}
          </p>
        </Section>

        <Section title={translate(locale, "Managing your data")}>
          <p>
            {french
              ? "Vous pouvez effacer votre historique depuis les réglages du site de votre navigateur. Si vous refusez l’avis relatif aux cookies, rien n’est enregistré : les écritures commencent uniquement après votre consentement."
              : "You can clear your watch history from your browser's site settings; that wipes the local storage key. If you decline the cookie notice, nothing gets recorded in the first place: writes only happen after you consent."}
          </p>
        </Section>

        <Section title={translate(locale, "Contact")}>
          <p>
            {french ? "Ouvrez un ticket sur le" : "Open an issue on the"}{" "}
            <ExtLink href="https://github.com/kacigaya/binje">
              {french ? "dépôt GitHub" : "GitHub repository"}
            </ExtLink>
            .
          </p>
        </Section>
      </div>

    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2
        className="mb-2 text-base font-semibold text-foreground"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function ExtLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-foreground underline decoration-accent-red/60 underline-offset-2 hover:decoration-accent-red transition-colors"
    >
      {children}
    </Link>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-white/8 px-1.5 py-0.5 text-xs text-foreground">
      {children}
    </code>
  );
}
