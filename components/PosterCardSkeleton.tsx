import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder matching `MediaCard`: poster plus its title and meta lines. */
export default function PosterCardSkeleton({ className = "w-40 shrink-0 sm:w-46.25" }: { className?: string }) {
  return (
    <div className={className}>
      <Skeleton className="aspect-2/3 w-full rounded-xl" />
      <Skeleton className="mt-2 h-3.5 w-4/5" />
      <Skeleton className="mt-1.5 h-3 w-1/2" />
    </div>
  );
}
