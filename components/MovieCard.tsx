import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import type { Movie } from "@/types/tmdb";
import { posterUrl } from "@/lib/tmdb";

export default function MovieCard({ movie }: { movie: Movie }) {
  const poster = posterUrl(movie.poster_path, "w500");

  return (
    <Link href={`/movie/${movie.id}`} className="group block flex-shrink-0">
      <div className="relative w-[160px] sm:w-[185px] overflow-hidden rounded-xl bg-card transition-all duration-300 group-hover:scale-[1.04] group-hover:shadow-[0_0_30px_rgba(225,29,72,0.15)]">
        <div className="relative aspect-[2/3] overflow-hidden rounded-xl">
          <Image
            src={poster}
            alt={movie.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            sizes="(max-width: 640px) 160px, 185px"
          />
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Rating badge */}
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-sm px-2 py-0.5 text-xs font-semibold text-accent-red">
            <Star className="h-3 w-3 fill-accent-red" />
            {movie.vote_average.toFixed(1)}
          </div>

          {/* Title on hover */}
          <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <p className="text-sm font-semibold text-white leading-tight line-clamp-2">
              {movie.title}
            </p>
            {movie.release_date && (
              <p className="text-xs text-white/60 mt-1">
                {new Date(movie.release_date).getFullYear()}
              </p>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
