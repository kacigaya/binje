"use client";

import { Bookmark, Clapperboard, Film, Search, Tv } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@appica/ui-react/dialog";
import { Input } from "@appica/ui-react/input";
import { Spinner } from "@appica/ui-react/spinner";
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
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setQuery("");
          setHighlightedIndex(0);
        }
      }}
    >
      {/* No close button: the palette is dismissed with Escape or by picking a
          result, and a × in the corner would sit on top of the result list. */}
      <DialogContent
        aria-label={t("Command menu")}
        closeButton={false}
        className="top-24 w-[min(36rem,calc(100vw-2rem))] translate-y-0 overflow-hidden p-0"
      >
        <DialogTitle className="sr-only">{t("Command menu")}</DialogTitle>
        <div className="border-b">
          <Input
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
            inputSize="lg"
            variant="soft"
            startSlot={<Search aria-hidden="true" />}
            endSlot={loading ? <Spinner currentColor /> : undefined}
            className="rounded-none border-0 bg-transparent"
          />
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
                data-active={active || undefined}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-foreground-muted transition-colors data-active:bg-background-muted data-active:text-foreground-intense hover:bg-background-muted"
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <span className="shrink-0 text-xs uppercase tracking-wider text-foreground-subtle">
                  {item.hint}
                </span>
              </Link>
            );
          })}

          {showEmpty && (
            <p className="px-3 py-8 text-center text-sm text-foreground-muted">
              {t("No results found")}
            </p>
          )}

          {loading && items.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-foreground-muted">
              {t("Searching…")}
            </p>
          )}
        </div>

        <div className="border-t px-4 py-2 text-xs text-foreground-subtle">
          {t("Type at least 2 characters to search.")}
        </div>
      </DialogContent>
    </Dialog>
  );
}
