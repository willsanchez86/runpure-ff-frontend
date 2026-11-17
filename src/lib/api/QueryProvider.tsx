/** Mounts the shared TanStack Query client at the app root (foundation §6.3). */
"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { queryClient } from "./queryClient";

/** Wraps the app under AuthProvider in the root layout. */
export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
