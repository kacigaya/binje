import Image from "next/image";
import type { ReactNode } from "react";
import type { TMDBImageAsset } from "@/types/tmdb";
import { logoUrl } from "@/lib/tmdb";

/**
 * Backdrop, poster and title block shared by the movie and TV detail pages.
 *
 * On phones the poster shrinks to a thumbnail beside the title so the play
 * action lands in the first screen; from `sm` up it is the tall column the
 * rest of the details sit beside. The backdrop's minimum heights keep the
 * negative offset from pulling content under the fixed navbar on short
 * viewports.
 */
export default function DetailHero({
  title,
  backdrop,
  poster,
  logo,
  tagline,
  details,
  children,
}: {
  title: string;
  backdrop: string | null;
  poster: string;
  logo: TMDBImageAsset | null;
  tagline?: string;
  details: ReactNode;
  children?: ReactNode;
}) {
  const logoSrc = logoUrl(logo?.file_path ?? null);

  return (
    <div className="flex flex-col">
      <div className="relative h-[34vh] min-h-56 w-full sm:h-[60vh] sm:min-h-[30rem]">
        {backdrop && (
          <Image
            src={backdrop}
            alt=""
            fill
            priority
            className="object-cover object-top"
            sizes="100vw"
          />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/60 to-background/20" />
        <div className="absolute inset-0 hidden bg-linear-to-r from-background/90 via-background/40 to-transparent sm:block" />
      </div>

      <div className="relative z-10 mx-auto -mt-24 w-full max-w-7xl px-4 pb-16 sm:-mt-96 sm:px-6">
        <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-end gap-x-4 gap-y-5 sm:grid-cols-[16.25rem_minmax(0,1fr)] sm:items-start sm:gap-x-8">
          <div className="relative aspect-2/3 overflow-hidden rounded-xl shadow-2xl shadow-black/50 ring-1 ring-white/10 sm:row-span-2 sm:rounded-2xl">
            <Image
              src={poster}
              alt=""
              fill
              priority
              className="object-cover"
              sizes="(max-width: 640px) 104px, 260px"
            />
          </div>

          <div className="min-w-0 space-y-2 sm:pt-28">
            {logo && logoSrc ? (
              <>
                {/* The logo replaces the title visually; the heading keeps
                    the page from rendering without an h1. */}
                <h1 className="sr-only">{title}</h1>
                <Image
                  src={logoSrc}
                  alt=""
                  aria-hidden="true"
                  width={logo.width}
                  height={logo.height}
                  className="h-auto max-h-16 w-auto max-w-full object-contain object-left sm:max-h-28 sm:max-w-md"
                  priority
                />
              </>
            ) : (
              <h1
                className="text-2xl font-bold leading-tight tracking-tight text-balance sm:text-4xl lg:text-5xl"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {title}
              </h1>
            )}
            {tagline && (
              <p className="text-sm italic text-muted-foreground sm:text-lg">
                {tagline}
              </p>
            )}
          </div>

          <div className="col-span-2 min-w-0 space-y-5 sm:col-span-1 sm:col-start-2">
            {details}
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
