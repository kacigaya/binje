"use client";

import { Skeleton } from "boneyard-js/react";

export default function HomeLoading() {
  return (
    <Skeleton
      name="home"
      loading={true}
      animate="shimmer"
      fallback={
        <div className="flex flex-col">
          <div className="w-full h-[70vh] sm:h-[80vh] bg-muted animate-pulse" />
          <div className="-mt-20 relative z-10 flex flex-col gap-10 pb-16 max-w-7xl mx-auto w-full px-4 sm:px-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-4">
                <div className="h-8 w-48 bg-muted animate-pulse rounded" />
                <div className="flex gap-3 sm:gap-4">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <div
                      key={j}
                      className="shrink-0 w-40 sm:w-46 aspect-[2/3] bg-muted animate-pulse rounded-xl"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      }
    >
      {null}
    </Skeleton>
  );
}
