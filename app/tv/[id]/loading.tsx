"use client";

import { Skeleton } from "boneyard-js/react";

export default function TVShowLoading() {
  return (
    <Skeleton
      name="tv-detail"
      loading={true}
      animate="shimmer"
      fallback={
        <div className="flex flex-col">
          <div className="w-full h-[50vh] sm:h-[60vh] bg-muted animate-pulse" />
          <div className="relative -mt-48 z-10 mx-auto max-w-7xl w-full px-4 sm:px-6 pb-16">
            <div className="flex flex-col sm:flex-row gap-8">
              <div className="shrink-0 mx-auto sm:mx-0 w-50 sm:w-65 aspect-2/3 bg-muted animate-pulse rounded-2xl" />
              <div className="flex-1 space-y-5 pt-4 sm:pt-16">
                <div className="h-12 w-75 max-w-full bg-muted animate-pulse rounded" />
                <div className="h-5 w-64 bg-muted animate-pulse rounded" />
                <div className="h-12 w-44 bg-muted animate-pulse rounded-full" />
              </div>
            </div>
          </div>
        </div>
      }
    >
      {null}
    </Skeleton>
  );
}
