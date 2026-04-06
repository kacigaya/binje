"use client";

import { Skeleton } from "boneyard-js/react";
import type { ReactNode } from "react";

export default function BoneSkeleton({
  name,
  loading = false,
  children,
  fixture,
  fallback,
  className,
}: {
  name: string;
  loading?: boolean;
  children: ReactNode;
  fixture?: ReactNode;
  fallback?: ReactNode;
  className?: string;
}) {
  return (
    <Skeleton
      name={name}
      loading={loading}
      fixture={fixture}
      fallback={fallback}
      className={className}
      animate="shimmer"
    >
      {children}
    </Skeleton>
  );
}
