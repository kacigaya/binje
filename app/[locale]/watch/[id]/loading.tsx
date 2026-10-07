import { Skeleton } from "@/components/ui/skeleton";

export function WatchInfoLoading({ heading }: { heading?: string } = {}) {
  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-2 pb-12 space-y-4">
        <div className="space-y-4">
          {heading ? (
            <h1
              className="text-2xl font-bold tracking-tight sm:text-3xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {heading}
            </h1>
          ) : (
            <Skeleton className="h-12 w-64 max-w-full" />
          )}

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
  );
}

export function WatchPlayerLoading() {
  return (
    <div className="w-full max-w-7xl mx-auto px-0 sm:px-6 pb-6">
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-start">
        <Skeleton className="w-full aspect-video rounded-xl" />
        <Skeleton className="mx-4 h-28 rounded-xl sm:mx-0 lg:h-64" />
      </div>
    </div>
  );
}

export default function WatchLoading() {
  return (
    <div className="flex flex-col pt-24">
      <WatchPlayerLoading />
      <WatchInfoLoading />
    </div>
  );
}
