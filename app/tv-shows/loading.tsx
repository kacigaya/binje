import { Skeleton } from "@/components/ui/skeleton";

const SECTION_COUNT = 10;

export default function TVShowsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 pb-16 pt-24 sm:pt-28">
      <div className="px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg sm:h-11 sm:w-11" />
          <Skeleton className="h-9 w-44" />
        </div>
        <Skeleton className="mt-5 h-px w-full" />
      </div>

      {Array.from({ length: SECTION_COUNT }).map((_, i) => (
        <div key={i} className="space-y-4 px-4 sm:px-6">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-3 sm:gap-4">
            {Array.from({ length: 7 }).map((_, j) => (
              <Skeleton
                key={j}
                className="aspect-2/3 w-40 shrink-0 rounded-xl sm:w-46.25"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
