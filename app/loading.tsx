import { Skeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <div className="flex flex-col">
      {/* Hero skeleton */}
      <div className="relative w-full h-[70vh] sm:h-[80vh]">
        <Skeleton className="absolute inset-0 rounded-none" />
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/60 to-transparent" />
        <div className="absolute bottom-16 sm:bottom-24 left-4 sm:left-6 max-w-7xl mx-auto w-full space-y-4">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-14 w-100 max-w-[80vw]" />
          <Skeleton className="h-5 w-125 max-w-[90vw]" />
          <Skeleton className="h-5 w-87.5 max-w-[70vw]" />
          <div className="flex gap-3 pt-2">
            <Skeleton className="h-12 w-40 rounded-full" />
            <Skeleton className="h-12 w-36 rounded-full" />
          </div>
        </div>
      </div>

      {/* Carousel skeletons */}
      <div className="-mt-16 relative z-10 flex flex-col gap-10 pb-16 max-w-7xl mx-auto w-full">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-4 px-4 sm:px-6">
            <Skeleton className="h-8 w-48" />
            <div className="flex gap-3 sm:gap-4">
              {Array.from({ length: 7 }).map((_, j) => (
                <Skeleton
                  key={j}
                  className="shrink-0 w-40 sm:w-46.25 aspect-2/3 rounded-xl"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
