"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/use-locale";

export default function RouteError({
  error,
  reset,
  title = "Something went wrong",
  message = "We couldn't load the content. This might be temporary. Please try again.",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  message?: string;
}) {
  const { t } = useTranslations();
  const localizedTitle = title === "Something went wrong" ? t(title) : title;
  const localizedMessage = message.startsWith("We couldn't load")
    ? t("We couldn't load the content. This might be temporary. Please try again.")
    : message;
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4">
      <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-8 text-destructive" />
      </div>
      <div className="space-y-2 text-center">
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {localizedTitle}
        </h2>
        <p className="max-w-md text-muted-foreground">{localizedMessage}</p>
      </div>
      <Button
        onClick={reset}
        variant="outline"
        className="gap-2 rounded-full cursor-pointer"
      >
        <RotateCcw className="size-4" />
        {t("Try Again")}
      </Button>
    </div>
  );
}
