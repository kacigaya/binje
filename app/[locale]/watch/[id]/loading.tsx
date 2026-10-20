import { Skeleton } from "@/components/ui/skeleton";

export function WatchInfoLoading({ heading }: { heading?: string } = {}) {
  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-2 pb-12 space-y-3">
      {heading ? (
        <h1
          className="text-2xl font-bold tracking-tight sm:text-3xl"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {heading}
        </h1>
      ) : (
        <Skeleton className="h-9 w-64 max-w-full" />
      )}
      <div className="flex flex-wrap items-center gap-4">
        <Skeleton className="h-5 w-14" />
        <Skeleton className="h-5 w-16" />
      </div>
      <Skeleton className="h-5 w-20" />
    </div>
  );
}

export function WatchPlayerLoading() {
  return (
    <div className="w-full max-w-7xl mx-auto px-0 sm:px-6 pb-6">
      <Skeleton className="w-full aspect-video rounded-xl" />
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
