"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { Film, Loader2, Search } from "lucide-react";
import { Menu as MenuNode, Search as SearchNode, X as XNode } from "lucide";
import { MorphIcon } from "morphicons/react";
import {
  ArrowRightIcon,
  type ArrowRightIconHandle,
} from "@/components/ui/arrow-right";
import { BookmarkIcon } from "@/components/ui/bookmark";
import { ClapIcon } from "@/components/ui/clap";
import { TvIcon } from "@/components/ui/tv";
import {
  useState,
  useRef,
  SyntheticEvent,
  useEffect,
  useCallback,
  useTransition,
  type ForwardRefExoticComponent,
  type HTMLAttributes,
  type ReactNode,
  type RefAttributes,
} from "react";
import { localizedHref } from "@/lib/i18n";
import { useTranslations } from "@/lib/use-locale";
import {
  MIN_SUGGESTION_QUERY_LENGTH,
  suggestionHref,
  useSearchSuggestions,
  type SearchSuggestion,
} from "@/lib/use-search-suggestions";

/** The three nav icons share this shape, so one ref type drives all of them. */
type NavIconHandle = {
  startAnimation: () => void;
  stopAnimation: () => void;
};

type NavIcon = ForwardRefExoticComponent<
  HTMLAttributes<HTMLDivElement> & { size?: number } & RefAttributes<NavIconHandle>
>;

const NAV_LINKS: readonly {
  href: string;
  label: "Movies" | "TV Shows" | "Watchlist";
  icon: NavIcon;
}[] = [
  { href: "/movies", label: "Movies", icon: ClapIcon },
  { href: "/tv-shows", label: "TV Shows", icon: TvIcon },
  { href: "/watchlist", label: "Watchlist", icon: BookmarkIcon },
];

/**
 * A nav entry whose icon animates from the link's hover: the link is far wider
 * than the glyph, so the icon's own hover would miss most of the target.
 */
function NavLink({
  href,
  icon: Icon,
  iconSize,
  className,
  onClick,
  tabIndex,
  children,
}: {
  href: string;
  icon: NavIcon;
  iconSize: number;
  className: string;
  onClick?: () => void;
  tabIndex?: number;
  children: ReactNode;
}) {
  const icon = useRef<NavIconHandle>(null);

  return (
    <Link
      href={href}
      onClick={onClick}
      tabIndex={tabIndex}
      onMouseEnter={() => icon.current?.startAnimation()}
      onMouseLeave={() => icon.current?.stopAnimation()}
      onFocus={() => icon.current?.startAnimation()}
      onBlur={() => icon.current?.stopAnimation()}
      className={className}
    >
      <Icon ref={icon} size={iconSize} />
      {children}
    </Link>
  );
}

export default function Navbar() {
  const { locale, t } = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const submitIcon = useRef<ArrowRightIconHandle>(null);

  const { suggestions, loading } = useSearchSuggestions({
    query,
    locale,
    enabled: open,
  });

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
        setMenuOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < MIN_SUGGESTION_QUERY_LENGTH) return;

    startTransition(() => {
      router.push(
        localizedHref(locale, `/search?q=${encodeURIComponent(trimmedQuery)}`),
      );
      close();
    });
  }

  function openSuggestion(suggestion: SearchSuggestion) {
    startTransition(() => {
      router.push(localizedHref(locale, suggestionHref(suggestion)));
      close();
    });
  }

  return (
    <nav className="fixed top-[max(0.75rem,env(safe-area-inset-top))] left-3 right-3 z-50">
      <div className="mx-auto max-w-7xl rounded-[2rem] bg-background/50 backdrop-blur-xl border border-white/10 shadow-lg shadow-black/30">
        <div className="flex items-center justify-between px-4 sm:px-6 h-16">
        <Link
          href={localizedHref(locale, "/")}
          onClick={() => setMenuOpen(false)}
          className="flex items-center gap-2 text-xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          <Film className="size-6 text-accent-red" />
          <span className="text-foreground">
            b<span className="text-accent-red">!</span>nje
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          {!open && (
            <div className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map((link) => {
                const href = localizedHref(locale, link.href);
                const active = pathname === href;

                return (
                  <NavLink
                    key={link.href}
                    href={href}
                    icon={link.icon}
                    iconSize={16}
                    className={`flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
                      active
                        ? "bg-white/10 text-foreground"
                        : "text-muted-foreground hover:bg-white/8 hover:text-foreground"
                    }`}
                  >
                    {t(link.label)}
                  </NavLink>
                );
              })}
            </div>
          )}

          {!open && (
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="relative flex md:hidden items-center justify-center size-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/8 transition-colors cursor-pointer"
              aria-label={menuOpen ? t("Close menu") : t("Open menu")}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
            >
              <MorphIcon icon={menuOpen ? XNode : MenuNode} size={20} reducedMotion="user" />
            </button>
          )}

          {!pathname.startsWith(`/${locale}/search`) && (
            <div className="flex items-center gap-2">
              {open && (
                <form onSubmit={handleSubmit} className="flex items-center">
                  <div className="relative">
                    <Search
                      aria-hidden="true"
                      className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
                    />
                    <input
                      ref={inputRef}
                      type="text"
                      required
                      minLength={MIN_SUGGESTION_QUERY_LENGTH}
                      disabled={pending}
                      placeholder={t("Search movies & TV...")}
                      aria-label={t("Search movies & TV...")}
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      className="h-9 w-56 sm:w-72 rounded-full bg-white/8 border border-white/15 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent-red/50 focus:border-accent-red/50 transition disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      disabled={pending || query.trim().length < MIN_SUGGESTION_QUERY_LENGTH}
                      onMouseEnter={() => submitIcon.current?.startAnimation()}
                      onMouseLeave={() => submitIcon.current?.stopAnimation()}
                      onFocus={() => submitIcon.current?.startAnimation()}
                      onBlur={() => submitIcon.current?.stopAnimation()}
                      aria-label={t("Search movies & TV...")}
                      className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      {pending ? (
                        <Loader2
                          aria-hidden="true"
                          className="size-4 animate-spin motion-reduce:animate-none"
                        />
                      ) : (
                        <ArrowRightIcon ref={submitIcon} aria-hidden="true" size={16} />
                      )}
                    </button>
                    <span role="status" aria-live="polite" className="sr-only">
                      {pending ? t("Searching…") : loading ? t("Searching…") : ""}
                    </span>
                    {suggestions.length > 0 && (
                      <div className="absolute right-0 top-12 w-72 overflow-hidden rounded-xl border border-white/10 bg-background/95 shadow-2xl shadow-black/40 backdrop-blur-xl">
                        {suggestions.map((suggestion) => {
                          const title =
                            suggestion.title ?? suggestion.name ?? t("Untitled");
                          const date =
                            suggestion.release_date ?? suggestion.first_air_date;
                          const year = date ? new Date(date).getFullYear() : null;

                          return (
                            <button
                              key={`${suggestion.media_type}-${suggestion.id}`}
                              type="button"
                              onClick={() => openSuggestion(suggestion)}
                              className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/8 focus:bg-white/8 focus:outline-none"
                            >
                              <span className="relative h-12.5 w-8.5 shrink-0 overflow-hidden rounded bg-white/8">
                                {suggestion.poster_path ? (
                                  <Image
                                    src={`https://image.tmdb.org/t/p/w92${suggestion.poster_path}`}
                                    alt={title}
                                    fill
                                    className="object-cover"
                                    sizes="34px"
                                  />
                                ) : (
                                  <span className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-muted-foreground">
                                    {suggestion.media_type === "tv" ? "TV" : "M"}
                                  </span>
                                )}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-foreground">
                                  {title}
                                </span>
                                {year && (
                                  <span className="text-xs text-muted-foreground">
                                    {year}
                                  </span>
                                )}
                              </span>
                              <span className="ml-auto shrink-0 rounded-full bg-accent-red/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-red">
                                {t(suggestion.media_type === "tv" ? "TV" : "Movie")}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </form>
              )}
              <button
                type="button"
                onClick={() => {
                  if (open) {
                    close();
                    return;
                  }
                  setOpen(true);
                  setMenuOpen(false);
                }}
                className="flex items-center justify-center size-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/8 transition-colors cursor-pointer"
                aria-label={t(open ? "Close search" : "Open search")}
                aria-expanded={open}
              >
                <MorphIcon icon={open ? XNode : SearchNode} size={20} reducedMotion="user" />
              </button>
            </div>
          )}
        </div>
        </div>

        <div
          id="mobile-menu"
          className={`grid md:hidden overflow-hidden transition-[grid-template-rows,opacity,transform] duration-300 ease-out motion-reduce:transition-none ${
            menuOpen
              ? "grid-rows-[1fr] opacity-100 translate-y-0"
              : "grid-rows-[0fr] -translate-y-2 opacity-0 pointer-events-none"
          }`}
          aria-hidden={!menuOpen}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="flex flex-col gap-1 px-4 py-3 sm:px-6">
              {NAV_LINKS.map((link) => {
                const href = localizedHref(locale, link.href);
                const active = pathname === href;

                return (
                  <NavLink
                    key={link.href}
                    href={href}
                    icon={link.icon}
                    iconSize={20}
                    onClick={() => setMenuOpen(false)}
                    tabIndex={menuOpen ? 0 : -1}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition duration-200 ${
                      active
                        ? "bg-white/10 text-foreground"
                        : "text-muted-foreground hover:bg-white/8 hover:text-foreground"
                    } ${
                      menuOpen ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
                    }`}
                  >
                    {t(link.label)}
                  </NavLink>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
