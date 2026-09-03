import { Skeleton } from "@appica/ui-react/skeleton";

export default function CarouselSkeleton() {
  return (
    <section className="space-y-4 px-4 sm:px-6" aria-hidden="true">
      <Skeleton className="h-8 w-48" />
      <div className="flex gap-3 overflow-hidden sm:gap-4">
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton
            key={index}
            className="aspect-2/3 w-40 shrink-0 rounded-xl sm:w-46.25"
          />
        ))}
      </div>
    </section>
  );
}
