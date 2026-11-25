"use client";

import Image, { type ImageProps } from "next/image";
import { tmdbImageLoader } from "@/lib/image-loader";

// TMDB sends CORS headers only to CORS requests and omits `Vary: Origin`, so a plain load poisons
// the cache for the liquid glass, which repaints images through a CORS request.
export default function TmdbImage({ alt, loader, crossOrigin = "anonymous", ...props }: ImageProps) {
  const tmdb = typeof props.src === "string" && props.src.startsWith("https://image.tmdb.org/t/p/");
  return <Image {...props} alt={alt} crossOrigin={crossOrigin} loader={loader ?? (tmdb ? tmdbImageLoader : undefined)} />;
}
