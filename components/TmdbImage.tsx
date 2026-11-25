"use client";

import Image, { type ImageProps } from "next/image";
import { tmdbImageLoader } from "@/lib/image-loader";

export default function TmdbImage({ alt, loader, ...props }: ImageProps) {
  const tmdb = typeof props.src === "string" && props.src.startsWith("https://image.tmdb.org/t/p/");
  return <Image {...props} alt={alt} loader={loader ?? (tmdb ? tmdbImageLoader : undefined)} />;
}
