import { Skeleton } from "@/components/ui/skeleton";

export default function WatchLoading() {
  return (
    <div className="flex flex-col pt-16">
      {/* Movie info above player */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-6 pb-4 space-y-4">
        <div className="space-y-4 mt-6">
          <Skeleton className="h-12 w-64 max-w-full" />

          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-20 rounded-full" />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-16" />
          </div>

          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </div>

      {/* Player */}
      <div className="w-full max-w-7xl mx-auto px-0 sm:px-6 pb-8">
        <Skeleton className="w-full aspect-video rounded-xl" />
      </div>
    </div>
  );
}
