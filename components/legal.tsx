import Link from "next/link";

/** Shared building blocks for the static legal pages (privacy, DMCA). */
export function Section({
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

export function ExtLink({
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
