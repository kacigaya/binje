import { Skeleton } from "@/components/ui/skeleton";
import DetailHeroSkeleton from "@/components/DetailHeroSkeleton";

export default function MovieLoading({ heading }: { heading?: string } = {}) {
  return (
    <DetailHeroSkeleton heading={heading} metaCount={3}>
      <div className="mt-12 space-y-4">
        <Skeleton className="h-7 w-20" />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="shrink-0 w-27.5 flex flex-col items-center gap-2"
            >
              <Skeleton className="size-27.5 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    </DetailHeroSkeleton>
  );
}
