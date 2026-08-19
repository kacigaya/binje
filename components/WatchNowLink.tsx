"use client";

import Link from "next/link";
import { PlayIcon } from "@/components/ui/play";
import { useAnimatedIcon } from "@/lib/use-animated-icon";

/**
 * The primary "watch" call to action. It is a client component so the play
 * glyph can react to the link, which the detail pages render from the server.
 */
export default function WatchNowLink({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className: string;
}) {
  const [icon, feedback] = useAnimatedIcon();

  return (
    <Link href={href} {...feedback} className={className}>
      <PlayIcon ref={icon} size={20} />
      {label}
    </Link>
  );
}
