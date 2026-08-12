"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const CommandMenu = dynamic(() => import("@/components/CommandMenu"), { ssr: false });

export default function CommandMenuLoader() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    function loadOnShortcut(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      setLoaded(true);
    }
    window.addEventListener("keydown", loadOnShortcut);
    return () => window.removeEventListener("keydown", loadOnShortcut);
  }, []);
  return loaded ? <CommandMenu initialOpen /> : null;
}
