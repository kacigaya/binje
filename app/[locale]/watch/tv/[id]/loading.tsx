import { Skeleton } from "@/components/ui/skeleton";

export default function WatchTVLoading() {
  return (
    <div className="flex flex-col pt-20">
      {/* Show info above player */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-6 pb-4 space-y-4">
        <div className="space-y-4 mt-6">
          <Skeleton className="h-12 w-64 max-w-full" />

          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-20 rounded-full" />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-16" />
          </div>

          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </div>

      {/* Player + episodes */}
      <div className="w-full max-w-7xl mx-auto px-0 sm:px-6 pb-8">
        <div className="space-y-4">
          <Skeleton className="w-full aspect-video rounded-xl" />

          {/* Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 px-4 sm:px-0">
            <Skeleton className="h-9 w-40 rounded-lg" />
            <Skeleton className="h-5 w-56" />
            <div className="flex items-center gap-2 sm:ml-auto">
              <Skeleton className="h-9 w-28 rounded-lg" />
              <Skeleton className="h-9 w-24 rounded-lg" />
            </div>
          </div>

          {/* Episodes */}
          <div className="px-4 sm:px-0">
            <Skeleton className="h-6 w-24 mb-3" />
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pt-1 pl-1 pb-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="w-72 sm:w-80 shrink-0 aspect-video rounded-2xl"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
