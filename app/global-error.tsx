"use client";

import RouteError from "@/components/RouteError";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <RouteError error={error} reset={reset} />
      </body>
    </html>
  );
}
