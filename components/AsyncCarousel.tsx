import LazyCarousel from "@/components/LazyCarousel";
import type { MediaItem } from "@/types/tmdb";

export default async function AsyncCarousel({
  title,
  items,
}: {
  title: string;
  items: Promise<MediaItem[]>;
}) {
  const resolved = await items;
  // A rail whose upstream call failed arrives empty; a bare heading over an
  // empty strip reads as a bug, so drop the section instead.
  if (resolved.length === 0) return null;
  return <LazyCarousel title={title} items={resolved} />;
}
