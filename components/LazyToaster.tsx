"use client";

import dynamic from "next/dynamic";

const Toaster = dynamic(() => import("sonner").then((module) => module.Toaster), { ssr: false });

export default function LazyToaster() {
  return (
    <Toaster position="bottom-center" theme="dark" style={{ fontFamily: "var(--font-sans)" }} toastOptions={{
      unstyled: true,
      classNames: {
        toast: "flex w-full items-center gap-3 rounded-[2rem] border border-white/10 bg-background/50 px-5 py-4 shadow-lg shadow-black/30 backdrop-blur-xl",
        title: "text-sm font-semibold text-foreground",
        description: "text-xs text-muted-foreground",
        icon: "flex shrink-0 items-center text-accent-red [&_svg]:size-5",
        actionButton: "ml-auto shrink-0 rounded-full bg-accent-red px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-red/90 cursor-pointer",
        closeButton: "rounded-full border border-white/10 bg-white/8 text-muted-foreground hover:text-foreground",
      },
    }} />
  );
}
