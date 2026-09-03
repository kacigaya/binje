"use client";

import { Dialog } from "@base-ui/react/dialog";
import {
  Bookmark,
  Clapperboard,
  Film,
  Loader2,
  Search,
  Tv,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { localizedHref, type TranslationKey } from "@/lib/i18n";
import { useTranslations } from "@/lib/use-locale";
import {
  MIN_SUGGESTION_QUERY_LENGTH,
  suggestionHref,
  suggestionTitle,
  useSearchSuggestions,
} from "@/lib/use-search-suggestions";

const PAGES: { href: string; label: TranslationKey; icon: typeof Film }[] = [
  { href: "/", label: "Home", icon: Film },
  { href: "/movies", label: "Movies", icon: Clapperboard },
  { href: "/tv-shows", label: "TV Shows", icon: Tv },
  { href: "/watchlist", label: "Watchlist", icon: Bookmark },
];

export default function CommandMenu({ initialOpen = false }: { initialOpen?: boolean }) {
  const { locale, t } = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const { suggestions, loading } = useSearchSuggestions({
    query,
    locale,
    enabled: open,
    limit: 6,
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) {
        return;
      }
      event.preventDefault();
      setOpen((previous) => !previous);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const pages = query.trim()
    ? PAGES.filter((page) =>
        t(page.label).toLowerCase().includes(query.trim().toLowerCase()),
      )
    : PAGES;

  const items = [
    ...pages.map((page) => ({
      key: `page:${page.href}`,
      href: page.href,
      label: t(page.label),
      hint: t("Pages"),
      icon: page.icon,
    })),
    ...suggestions.map((suggestion) => ({
      key: `result:${suggestion.media_type}:${suggestion.id}`,
      href: suggestionHref(suggestion),
      label: suggestionTitle(suggestion),
      hint: t(suggestion.media_type === "tv" ? "TV" : "Movie"),
      icon: suggestion.media_type === "tv" ? Tv : Clapperboard,
    })),
  ];

  // The list shrinks as results arrive, so clamp instead of resetting in an effect.
  const activeIndex = Math.min(highlightedIndex, Math.max(items.length - 1, 0));

  const select = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(localizedHref(locale, href));
    },
    [locale, router],
  );

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (items.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((index) => (index + 1) % items.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((index) => (index - 1 + items.length) % items.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      setHighlightedIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setHighlightedIndex(items.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = items[activeIndex];
      if (item) select(item.href);
    }
  }

  const showEmpty =
    items.length === 0 &&
    !loading &&
    query.trim().length >= MIN_SUGGESTION_QUERY_LENGTH;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setQuery("");
          setHighlightedIndex(0);
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-100 bg-black/70 backdrop-blur-sm" />
        <Dialog.Popup
          aria-label={t("Command menu")}
          className="fixed left-1/2 top-24 z-100 w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/10 bg-background/95 shadow-2xl shadow-black/50 backdrop-blur outline-none"
        >
          <Dialog.Title className="sr-only">{t("Command menu")}</Dialog.Title>
          <div className="relative border-b border-white/10">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              // The palette only ever opens from an explicit shortcut or
              // click, so focusing its single input is what was asked for.
              autoFocus
              type="search"
              name="q"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={onInputKeyDown}
              placeholder={t("Search or jump to…")}
              aria-label={t("Search or jump to…")}
              aria-controls="command-menu-list"
              aria-activedescendant={items[activeIndex]?.key}
              className="h-14 w-full bg-transparent pl-11 pr-4 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-red/50"
            />
            {loading && (
              <Loader2
                aria-hidden="true"
                className="absolute right-4 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground motion-reduce:animate-none"
              />
            )}
          </div>

          <div
            id="command-menu-list"
            role="listbox"
            aria-label={t("Results")}
            className="max-h-80 overflow-y-auto overscroll-contain p-1.5"
          >
            {items.map((item, index) => {
              const Icon = item.icon;
              const active = index === activeIndex;

              return (
                // A link, so a result can be opened in a new tab, and
                // tabIndex={-1} because the input owns focus and points at the
                // active option through aria-activedescendant.
                <Link
                  key={item.key}
                  id={item.key}
                  href={localizedHref(locale, item.href)}
                  role="option"
                  aria-selected={active}
                  tabIndex={-1}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => setOpen(false)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60 ${
                    active
                      ? "bg-white/10 text-foreground"
                      : "text-muted-foreground hover:bg-white/8"
                  }`}
                >
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <span className="shrink-0 text-xs uppercase tracking-wider text-muted-foreground">
                    {item.hint}
                  </span>
                </Link>
              );
            })}

            {showEmpty && (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                {t("No results found")}
              </p>
            )}

            {loading && items.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                {t("Searching…")}
              </p>
            )}
          </div>

          <div className="border-t border-white/10 px-4 py-2 text-xs text-muted-foreground">
            {t("Type at least 2 characters to search.")}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
