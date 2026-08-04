import Link from "next/link";
import { Compass, Home } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";
import "./globals.css";

// Lives at the app root, not under [locale]: Next resolves notFound() and
// unmatched URLs to the root boundary, so a [locale] copy never renders.
// The proxy redirects "/" to the visitor's preferred locale.
export default function NotFound() {
  return (
    <div className="dark flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4 text-foreground antialiased">
      <div className="flex size-16 items-center justify-center rounded-full bg-white/8">
        <Compass className="size-8 text-accent-red" />
      </div>
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Page not found</h1>
        <p className="max-w-md text-muted-foreground">
          This page doesn&apos;t exist or has moved. Check the address or head
          back home.
        </p>
      </div>
      <Link
        href="/"
        className={buttonClassName({
          variant: "outline",
          className: "gap-2 rounded-full h-11 px-6 cursor-pointer",
        })}
      >
        <Home className="size-4" />
        Back to home
      </Link>
    </div>
  );
}
