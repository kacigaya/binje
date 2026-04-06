import { Skeleton } from "@/components/ui/skeleton";

export default function TVShowLoading() {
  return (
    <div className="flex flex-col">
      <div className="relative w-full h-[50vh] sm:h-[60vh]">
        <Skeleton className="absolute inset-0 rounded-none" />
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/70 to-background/30" />
      </div>

      <div className="relative -mt-48 z-10 mx-auto max-w-7xl w-full px-4 sm:px-6 pb-16">
        <div className="flex flex-col sm:flex-row gap-8">
          <Skeleton className="shrink-0 mx-auto sm:mx-0 w-50 sm:w-65 aspect-2/3 rounded-2xl" />

          <div className="flex-1 space-y-5 pt-4 sm:pt-16">
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-20 rounded-full" />
              ))}
            </div>
            <Skeleton className="h-12 w-75 max-w-full" />
            <Skeleton className="h-5 w-64" />
            <div className="flex gap-4">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-32" />
            </div>
            <Skeleton className="h-12 w-44 rounded-full" />
            <Skeleton className="h-px w-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </div>

        {/* Seasons skeleton */}
        <div className="mt-12 space-y-4">
          <Skeleton className="h-7 w-24" />
          <div className="flex gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton
                key={i}
                className="shrink-0 w-35 sm:w-40 aspect-2/3 rounded-xl"
              />
            ))}
          </div>
        </div>

        {/* Cast skeleton */}
        <div className="mt-12 space-y-4">
          <Skeleton className="h-7 w-20" />
          <div className="flex gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="shrink-0 w-27.5 flex flex-col items-center gap-2"
              >
                <Skeleton className="w-27.5 h-27.5 rounded-full" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
