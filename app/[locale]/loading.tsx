import { Skeleton } from "@/components/ui/skeleton";
import HeroSkeleton from "@/components/HeroSkeleton";

const SECTION_COUNT = 3;

export default function HomeLoading() {
  return (
    <div className="flex flex-col">
      <HeroSkeleton />

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
