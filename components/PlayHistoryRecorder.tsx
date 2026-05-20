"use client";

import { useEffect } from "react";
import {
  type PlayHistoryInput,
  upsertPlayHistory,
} from "@/lib/play-history";

export default function PlayHistoryRecorder({
  item,
}: {
  item: PlayHistoryInput;
}) {
  useEffect(() => {
    upsertPlayHistory(item);
  }, [item]);

  return null;
}
