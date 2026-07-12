"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Cookie, Film, ShieldCheck } from "lucide-react";
import { localizedHref } from "@/lib/i18n";
import { useTranslations } from "@/lib/use-locale";

export default function Footer() {
  const { locale, t } = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  return (
    <footer className="border-t border-white/10 bg-background/80">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-col items-center justify-between gap-3 px-4 py-3 sm:h-16 sm:flex-row sm:px-6 sm:py-0">
        <div
          className="flex items-center gap-2 text-sm text-muted-foreground"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          <Film className="size-4 text-accent-red" />
          <span className="font-bold tracking-tight text-foreground">
            b<span className="text-accent-red">!</span>nje
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          <div className="flex items-center rounded-full border border-white/10 bg-white/5 p-0.5 text-xs font-semibold">
            {(["en", "fr"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-current={locale === value ? "page" : undefined}
                onClick={() => {
                  const nextPath = pathname.replace(/^\/(en|fr)(?=\/|$)/, `/${value}`);
                  router.push(`${nextPath}${window.location.search}`);
                }}
                className={`rounded-full px-2 py-1 uppercase transition-colors cursor-pointer ${
                  locale === value
                    ? "bg-accent-red text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              window.localStorage.removeItem("binje:cookie-consent");
              window.location.reload();
            }}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <Cookie className="size-4" />
            {t("Cookies")}
          </button>
          <Link
            href={localizedHref(locale, "/privacy")}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ShieldCheck className="size-4" />
            {t("Privacy")}
          </Link>
          <Link
            href="https://github.com/kacigaya/binje"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg
              role="img"
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="size-4 fill-current"
            >
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
            </svg>
            GitHub
          </Link>
        </div>
      </div>
    </footer>
  );
}
