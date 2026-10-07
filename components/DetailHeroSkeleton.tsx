import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

/** Loading state matching `DetailHero`'s grid so the page does not jump. */
export default function DetailHeroSkeleton({
  heading,
  metaCount,
  children,
}: {
  heading?: string;
  metaCount: number;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <div className="relative h-[34vh] min-h-56 w-full sm:h-[60vh] sm:min-h-[30rem]">
        <Skeleton className="absolute inset-0 rounded-none" />
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/60 to-background/20" />
      </div>

      <div className="relative z-10 mx-auto -mt-24 w-full max-w-7xl px-4 pb-16 sm:-mt-96 sm:px-6">
        <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-end gap-x-4 gap-y-5 sm:grid-cols-[16.25rem_minmax(0,1fr)] sm:items-start sm:gap-x-8">
          <Skeleton className="aspect-2/3 w-full rounded-xl sm:row-span-2 sm:rounded-2xl" />

          <div className="min-w-0 space-y-2 sm:pt-28">
            {heading ? (
              <h1
                className="text-2xl font-bold tracking-tight sm:text-4xl lg:text-5xl"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {heading}
              </h1>
            ) : (
              <Skeleton className="h-12 w-75 max-w-full" />
            )}
            <Skeleton className="h-5 w-48 max-w-full" />
          </div>

          <div className="col-span-2 min-w-0 space-y-5 sm:col-span-1 sm:col-start-2">
            <div className="flex flex-wrap gap-4">
              {Array.from({ length: metaCount }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-24" />
              ))}
            </div>
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-16 rounded-full" />
              ))}
            </div>
            <Skeleton className="h-12 w-full rounded-full sm:w-44" />
            <Skeleton className="h-px w-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
