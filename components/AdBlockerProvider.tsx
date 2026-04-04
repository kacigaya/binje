"use client";

import { useEffect } from "react";

/**
 * Registers the ad blocker Service Worker globally on app load.
 * This ensures the SW is active before the user navigates to any player page,
 * so ad requests are intercepted from the very first load.
 */
export default function AdBlockerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw-adblocker.js", { scope: "/" })
        .catch(() => {
          // SW registration failed — non-critical, ad blocker will still
          // work via the client-side interception in blocker.ts
        });
    }
  }, []);

  return <>{children}</>;
}
