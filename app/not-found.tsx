"use client";

import Link from "next/link";
import { Compass } from "lucide-react";
import { GlassButton } from "@/components/liquid-glass";
import MotionProvider from "@/components/MotionProvider";
import { HomeIcon } from "@/components/ui/home";
import { useAnimatedIcon } from "@/lib/use-animated-icon";
import "./globals.css";

// Next resolves unmatched URLs to the root boundary; a [locale] copy never renders.
// The proxy redirects "/" to the visitor's preferred locale.
export default function NotFound() {
  const [homeIcon, homeFeedback] = useAnimatedIcon();

  return (
    <div className="dark flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4 text-foreground antialiased">
      <div className="flex size-16 items-center justify-center rounded-full bg-white/8">
        <Compass className="size-8 text-muted-foreground" />
      </div>
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Page not found</h1>
        <p className="max-w-md text-muted-foreground">
          This page doesn’t exist or has moved. Check the address or head
          back home.
        </p>
      </div>
      <GlassButton
        asChild
        tint={0.15}
        icon={
          <MotionProvider>
            <HomeIcon ref={homeIcon} size={16} />
          </MotionProvider>
        }
        iconPosition="start"
      >
        <Link href="/" {...homeFeedback}>
          Back to home
        </Link>
      </GlassButton>
    </div>
  );
}
