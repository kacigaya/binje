import type { Metadata } from "next";
import { ExtLink, Section } from "@/components/legal";
import { translate, type Locale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: translate(locale, "DMCA Policy"),
    description: translate(locale, "b!nje hosts no files. How to report content you own the rights to."),
    // The locale layout canonicalises everything to `/${locale}` by default.
    alternates: { canonical: `/${locale}/dmca` },
  };
}

export default async function DmcaPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const french = locale === "fr";
  return (
    <div className="mx-auto mt-16 max-w-2xl px-4 py-12 sm:mt-24 sm:px-6 sm:py-16">
      <h1
        className="mb-8 text-3xl font-bold tracking-tight"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {translate(locale, "DMCA Policy")}
      </h1>

      <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
        <Section title={translate(locale, "No files are hosted here")}>
          <p>
            {french
              ? "b!nje n’héberge aucun fichier sur ses serveurs. Tous les contenus sont fournis par des tiers non affiliés. Nous ne mettons en ligne, ne stockons et ne diffusons aucune vidéo : les liens de lecture pointent vers des services externes sur lesquels nous n’avons aucun contrôle."
              : "b!nje hosts no files on its servers. All content is provided by unaffiliated third parties. We do not upload, store, or transmit any video: playback links point to external services we have no control over."}
          </p>
        </Section>

        <Section title={translate(locale, "Sending a claim")}>
          <p>
            {french
              ? "Comme les fichiers ne se trouvent pas chez nous, une réclamation adressée à b!nje ne peut pas les faire disparaître. Adressez-vous d’abord au service qui héberge réellement le fichier. Nous pouvons en revanche retirer une référence de notre catalogue : ouvrez un ticket sur le"
              : "Because the files are not on our servers, a claim sent to b!nje cannot take them down. Contact the service that actually hosts the file first. We can still remove a reference from our catalogue: open an issue on the"}{" "}
            <ExtLink href="https://github.com/kacigaya/binje/issues">
              {french ? "dépôt GitHub" : "GitHub repository"}
            </ExtLink>
            .
          </p>
        </Section>

        <Section title={translate(locale, "What your claim must contain")}>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              {french
                ? "L’URL exacte de la page b!nje concernée."
                : "The exact URL of the b!nje page concerned."}
            </li>
            <li>
              {french
                ? "L’identification de l’œuvre protégée et la preuve que vous en détenez les droits, ou que vous agissez pour le titulaire."
                : "Identification of the protected work, and proof that you hold the rights or act on the rights holder's behalf."}
            </li>
            <li>
              {french
                ? "Vos coordonnées de contact."
                : "Your contact details."}
            </li>
          </ul>
        </Section>

        <Section title={translate(locale, "Contact")}>
          <p>
            {french ? "Ouvrez un ticket sur le" : "Open an issue on the"}{" "}
            <ExtLink href="https://github.com/kacigaya/binje/issues">
              {french ? "dépôt GitHub" : "GitHub repository"}
            </ExtLink>
            .
          </p>
        </Section>
      </div>
    </div>
  );
}
