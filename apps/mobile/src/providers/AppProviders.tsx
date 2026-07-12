import { PropsWithChildren, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "./queryClient";

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(createQueryClient);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
