import { Skeleton } from "@/components/ui/skeleton";

const SECTION_COUNT = 3;

export default function HomeLoading() {
  return (
    <div className="flex flex-col">
      <div className="relative h-[70vh] w-full overflow-hidden sm:h-[80vh]">
        <Skeleton className="absolute inset-0 rounded-none" />
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/60 to-transparent" />
        <div className="absolute inset-0 bg-linear-to-t from-background/80 via-transparent to-transparent" />

        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 sm:pb-24">
            <div className="max-w-2xl space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 w-10" />
              </div>
              <Skeleton className="h-12 w-96 max-w-[80vw] sm:h-14 lg:h-16" />
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
      </div>

      <div className="-mt-12 relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-10 pb-16">
        {Array.from({ length: SECTION_COUNT }).map((_, i) => (
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
