import type { Metadata } from "next";
import Link from "next/link";
import { Film } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy — b!nje",
  description:
    "How b!nje handles your data: local watch history, no tracking, no third-party cookies.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-8 flex items-center gap-2">
        <Film className="h-5 w-5 text-accent-red" />
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Privacy Policy
        </h1>
      </div>

      <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
        <Section title="What we store">
          <p>
            We store your watch history in your browser&apos;s local storage
            (key: <Code>binje:play-history:v1</Code>) so you can resume what
            you were watching. This data never leaves your device.
          </p>
        </Section>

        <Section title="What we don't do">
          <p>
            We don&apos;t run analytics, don&apos;t set advertising cookies,
            and don&apos;t fingerprint your browser. There are no trackers on
            this site.
          </p>
        </Section>

        <Section title="Third parties">
          <p>
            Movie and TV metadata is fetched from{" "}
            <ExtLink href="https://www.themoviedb.org">
              The Movie Database
            </ExtLink>{" "}
            via our server-side API. When you press play, video is streamed
            from third-party embed sources. Those services may log requests
            on their end; their own privacy policies apply.
          </p>
        </Section>

        <Section title="Managing your data">
          <p>
            You can clear your watch history at any time from your browser&apos;s
            site settings (this wipes the local storage key). To stop history
            from being recorded going forward, simply don&apos;t accept the
            cookie notice — writes are gated behind your consent.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Open an issue on the{" "}
            <ExtLink href="https://github.com/kacigaya/binje">
              GitHub repository
            </ExtLink>
            .
          </p>
        </Section>
      </div>

      <div className="mt-12 border-t border-white/10 pt-6 text-xs text-muted-foreground">
        <Link
          href="/"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          ← Back home
        </Link>
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
