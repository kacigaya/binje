"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { Film, Search } from "lucide-react";
import { Menu as MenuNode, Search as SearchNode, X as XNode } from "lucide";
import { MorphIcon } from "morphicons/react";
import { Button } from "@appica/ui-react/button";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@appica/ui-react/drawer";
import { Input } from "@appica/ui-react/input";
import { NavigationLink } from "@appica/ui-react/navigation";
import { Spinner } from "@appica/ui-react/spinner";
import { ArrowRightIcon } from "@/components/ui/arrow-right";
import { BookmarkIcon } from "@/components/ui/bookmark";
import { ClapIcon } from "@/components/ui/clap";
import { TvIcon } from "@/components/ui/tv";
import {
  useState,
  useRef,
  SyntheticEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useCallback,
  Suspense,
  useTransition,
  type ForwardRefExoticComponent,
  type ComponentProps,
  type HTMLAttributes,
  type ReactNode,
  type RefAttributes,
} from "react";
import { useAnimatedIcon, type AnimatedIconHandle } from "@/lib/use-animated-icon";
import { localizedHref } from "@/lib/i18n";
import { useTranslations } from "@/lib/use-locale";
import {
  MIN_SUGGESTION_QUERY_LENGTH,
  suggestionHref,
  useSearchSuggestions,
} from "@/lib/use-search-suggestions";

type NavIcon = ForwardRefExoticComponent<
  HTMLAttributes<HTMLDivElement> & { size?: number } & RefAttributes<AnimatedIconHandle>
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
 * Appica's NavigationLink owns the pill styling and the active treatment.
 */
function NavLink({
  href,
  icon: Icon,
  iconSize,
  size = "sm",
  active,
  className,
  onClick,
  tabIndex,
  children,
}: {
  href: string;
  icon: NavIcon;
  iconSize: number;
  size?: "sm" | "md" | "lg";
  active?: boolean;
  className?: string;
  onClick?: () => void;
  tabIndex?: number;
  children: ReactNode;
}) {
  const [icon, feedback] = useAnimatedIcon();

  return (
    <NavigationLink
      variant="pill"
      size={size}
      active={active}
      className={className}
      render={
        <Link href={href} onClick={onClick} tabIndex={tabIndex} {...feedback} />
      }
    >
      <Icon ref={icon} size={iconSize} />
      {children}
    </NavigationLink>
  );
}

function ActiveNavLink(props: ComponentProps<typeof NavLink>) {
  const pathname = usePathname();

  return <NavLink {...props} active={pathname === props.href} />;
}

function HideOnSearchRoute({
  locale,
  children,
}: {
  locale: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  return pathname.startsWith(`/${locale}/search`) ? null : children;
}

export default function Navbar() {
  const { locale, t } = useTranslations();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const [submitIcon, submitFeedback] = useAnimatedIcon();

  const { suggestions, loading } = useSearchSuggestions({
    query,
    locale,
    enabled: open,
  });

  const normalizedSuggestionIndex =
    activeSuggestionIndex < 0
      ? -1
      : Math.min(activeSuggestionIndex, suggestions.length - 1);
  const activeSuggestion = suggestions[normalizedSuggestionIndex];

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

  function onSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (suggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestionIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestionIndex(
        (index) =>
          index < 0
            ? suggestions.length - 1
            : (index - 1 + suggestions.length) % suggestions.length,
      );
    } else if (event.key === "Enter" && activeSuggestion) {
      event.preventDefault();
      router.push(
        localizedHref(locale, suggestionHref(activeSuggestion)),
      );
      close();
    }
  }

  return (
    <nav className="fixed top-[max(0.75rem,env(safe-area-inset-top))] left-3 right-3 z-50">
      <div className="mx-auto max-w-7xl rounded-[2rem] border bg-background/50 shadow-lg backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 sm:px-6 h-16">
        <Link
          href={localizedHref(locale, "/")}
          onClick={() => setMenuOpen(false)}
          className="flex items-center gap-2 text-xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          <Film className="size-6 text-accent-red" />
          <span className="text-foreground-intense" translate="no">
            b<span className="text-accent-red">!</span>nje
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          {!open && (
            <div className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map((link) => {
                const href = localizedHref(locale, link.href);

                return (
                  <Suspense
                    key={link.href}
                    fallback={
                      <NavLink href={href} icon={link.icon} iconSize={16}>
                        {t(link.label)}
                      </NavLink>
                    }
                  >
                    <ActiveNavLink href={href} icon={link.icon} iconSize={16}>
                      {t(link.label)}
                    </ActiveNavLink>
                  </Suspense>
                );
              })}
            </div>
          )}

          {!open && (
            <Button
              variant="ghost"
              size="icon-md"
              onClick={() => setMenuOpen((v) => !v)}
              className="relative flex md:hidden"
              aria-label={menuOpen ? t("Close menu") : t("Open menu")}
              aria-expanded={menuOpen}
            >
              <MorphIcon icon={menuOpen ? XNode : MenuNode} size={20} reducedMotion="user" />
            </Button>
          )}

          <Suspense
            fallback={
              <Button
                variant="ghost"
                size="icon-md"
                onClick={() => {
                  setOpen(true);
                  setMenuOpen(false);
                }}
                aria-label={t("Open search")}
                aria-expanded={false}
              >
                <MorphIcon icon={SearchNode} size={20} reducedMotion="user" />
              </Button>
            }
          >
            <HideOnSearchRoute locale={locale}>
            <div className="flex items-center gap-2">
              {open && (
                <form onSubmit={handleSubmit} className="flex items-center">
                  <div className="relative">
                    <Input
                      ref={inputRef}
                      inputSize="sm"
                      variant="soft"
                      className="w-56 rounded-full sm:w-72"
                      startSlot={<Search aria-hidden="true" />}
                      endSlot={
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon-sm"
                          disabled={
                            pending ||
                            query.trim().length < MIN_SUGGESTION_QUERY_LENGTH
                          }
                          {...submitFeedback}
                          aria-label={t("Search movies & TV…")}
                        >
                          {pending ? (
                            <Spinner currentColor />
                          ) : (
                            <ArrowRightIcon ref={submitIcon} size={16} />
                          )}
                        </Button>
                      }
                      type="search"
                      name="q"
                      autoComplete="off"
                      // A title is not a word the dictionary knows, and the
                      // red underline reads as an error on a search field.
                      spellCheck={false}
                      enterKeyHint="search"
                      required
                      minLength={MIN_SUGGESTION_QUERY_LENGTH}
                      disabled={pending}
                      placeholder={t("Search movies & TV…")}
                      aria-label={t("Search movies & TV…")}
                      role="combobox"
                      aria-autocomplete="list"
                      aria-expanded={suggestions.length > 0}
                      aria-controls={
                        suggestions.length > 0
                          ? "navbar-search-suggestions"
                          : undefined
                      }
                      aria-activedescendant={
                        activeSuggestion
                          ? `navbar-suggestion-${activeSuggestion.media_type}-${activeSuggestion.id}`
                          : undefined
                      }
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value);
                        setActiveSuggestionIndex(-1);
                      }}
                      onKeyDown={onSearchKeyDown}
                    />
                    <span role="status" aria-live="polite" className="sr-only">
                      {pending ? t("Searching…") : loading ? t("Searching…") : ""}
                    </span>
                    {suggestions.length > 0 && (
                      <ul
                        id="navbar-search-suggestions"
                        role="listbox"
                        aria-label={t("Results")}
                        className="absolute right-0 top-12 w-72 overflow-hidden overscroll-contain rounded-xl border bg-background/95 shadow-2xl backdrop-blur-xl"
                      >
                        {suggestions.map((suggestion, index) => {
                          const title =
                            suggestion.title ?? suggestion.name ?? t("Untitled");
                          const date =
                            suggestion.release_date ?? suggestion.first_air_date;
                          const year = date ? new Date(date).getFullYear() : null;

                          return (
                            <li
                              key={`${suggestion.media_type}-${suggestion.id}`}
                              role="presentation"
                            >
                            {/* A suggestion is a destination, so it is a link:
                                Cmd-click and middle-click have to work. */}
                            <Link
                              id={`navbar-suggestion-${suggestion.media_type}-${suggestion.id}`}
                              href={localizedHref(locale, suggestionHref(suggestion))}
                              role="option"
                              aria-selected={index === normalizedSuggestionIndex}
                              tabIndex={-1}
                              onMouseEnter={() => setActiveSuggestionIndex(index)}
                              onClick={() => close()}
                              data-active={
                                index === normalizedSuggestionIndex || undefined
                              }
                              className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-background-muted data-active:bg-background-muted"
                            >
                              <span className="relative h-12.5 w-8.5 shrink-0 overflow-hidden rounded bg-background-muted">
                                {suggestion.poster_path ? (
                                  <Image
                                    src={`https://image.tmdb.org/t/p/w92${suggestion.poster_path}`}
                                    alt={title}
                                    fill
                                    className="object-cover"
                                    sizes="34px"
                                  />
                                ) : (
                                  <span className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-foreground-subtle">
                                    {suggestion.media_type === "tv" ? "TV" : "M"}
                                  </span>
                                )}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-foreground-intense">
                                  {title}
                                </span>
                                {year && (
                                  <span className="text-xs text-foreground-muted">
                                    {year}
                                  </span>
                                )}
                              </span>
                              <span className="ml-auto shrink-0 rounded-full bg-primary-subtle px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                                {t(suggestion.media_type === "tv" ? "TV" : "Movie")}
                              </span>
                            </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </form>
              )}
              <Button
                variant="ghost"
                size="icon-md"
                onClick={() => {
                  if (open) {
                    close();
                    return;
                  }
                  setOpen(true);
                  setMenuOpen(false);
                }}
                aria-label={t(open ? "Close search" : "Open search")}
                aria-expanded={open}
              >
                <MorphIcon icon={open ? XNode : SearchNode} size={20} reducedMotion="user" />
              </Button>
            </div>
            </HideOnSearchRoute>
          </Suspense>
        </div>
        </div>

        <Drawer
          side="bottom"
          open={menuOpen}
          onOpenChange={setMenuOpen}
        >
          <DrawerContent className="md:hidden">
            <DrawerTitle className="sr-only">{t("Open menu")}</DrawerTitle>
            <div className="flex flex-col gap-1 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {NAV_LINKS.map((link) => {
                const href = localizedHref(locale, link.href);

                return (
                  <Suspense
                    key={link.href}
                    fallback={
                      <NavLink
                        href={href}
                        icon={link.icon}
                        iconSize={20}
                        size="lg"
                        className="justify-start"
                        onClick={() => setMenuOpen(false)}
                      >
                        {t(link.label)}
                      </NavLink>
                    }
                  >
                    <ActiveNavLink
                      href={href}
                      icon={link.icon}
                      iconSize={20}
                      size="lg"
                      className="justify-start"
                      onClick={() => setMenuOpen(false)}
                    >
                      {t(link.label)}
                    </ActiveNavLink>
                  </Suspense>
                );
              })}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </nav>
  );
}
