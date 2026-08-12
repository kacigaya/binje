import LazyCarousel from "@/components/LazyCarousel";
import type { MediaItem } from "@/types/tmdb";

export default async function AsyncCarousel({
  title,
  items,
}: {
  title: string;
  items: Promise<MediaItem[]>;
}) {
  return <LazyCarousel title={title} items={await items} />;
}
