import { PropsWithChildren, useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import { focusManager, QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "./queryClient";
import { LocaleProvider } from "./LocaleProvider";
import { ToastProvider } from "./ToastProvider";

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(createQueryClient);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = AppState.addEventListener('change', state => focusManager.setFocused(state === 'active'));
    return () => { subscription.remove(); focusManager.setFocused(undefined); };
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <ToastProvider>{children}</ToastProvider>
      </LocaleProvider>
    </QueryClientProvider>
  );
}
