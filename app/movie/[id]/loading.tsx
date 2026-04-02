import { Skeleton } from "@/components/ui/skeleton";

export default function MovieLoading() {
  return (
    <div className="flex flex-col">
      {/* Backdrop skeleton */}
      <div className="relative w-full h-[50vh] sm:h-[60vh]">
        <Skeleton className="absolute inset-0 rounded-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
      </div>

      {/* Content skeleton */}
      <div className="relative -mt-48 z-10 mx-auto max-w-7xl w-full px-4 sm:px-6 pb-16">
        <div className="flex flex-col sm:flex-row gap-8">
          <Skeleton className="flex-shrink-0 mx-auto sm:mx-0 w-[200px] sm:w-[260px] aspect-[2/3] rounded-2xl" />

          <div className="flex-1 space-y-5 pt-4 sm:pt-16">
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-20 rounded-full" />
              ))}
            </div>
            <Skeleton className="h-12 w-[300px] max-w-full" />
            <Skeleton className="h-5 w-64" />
            <div className="flex gap-4">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-20" />
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

        {/* Cast skeleton */}
        <div className="mt-12 space-y-4">
          <Skeleton className="h-7 w-20" />
          <div className="flex gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[110px] flex flex-col items-center gap-2">
                <Skeleton className="w-[110px] h-[110px] rounded-full" />
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
