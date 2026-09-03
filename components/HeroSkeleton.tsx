import { Skeleton } from "@appica/ui-react/skeleton";

export default function HeroSkeleton() {
  return (
    <section
      className="relative h-[70vh] w-full overflow-hidden sm:h-[80vh]"
      aria-label="Loading featured titles"
    >
      <Skeleton className="absolute inset-0 rounded-none" />
      <div className="absolute inset-0 bg-linear-to-t from-background via-background/60 to-transparent" />
      <div className="absolute inset-0 bg-linear-to-t from-background/80 via-transparent to-transparent" />
      <div className="absolute inset-0 flex items-end">
        <div className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="max-w-2xl space-y-4">
            {/* Matches the pinned title slot in Hero so the swap is shift-free. */}
            <Skeleton className="h-28 w-72 max-w-[80vw] sm:h-36 sm:w-90" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-10" />
            </div>
            <div className="max-w-xl space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Skeleton className="h-12 w-40 rounded-full" />
              <Skeleton className="h-12 w-36 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
