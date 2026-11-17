/** The app's single TanStack Query client (foundation spec §6.3, ADR-0019).
 * Phase 1 data changes once a day, so nothing revalidates in the background:
 * staleness is reported by the API's dataFreshness field, never cache age. */
import { QueryClient } from "@tanstack/react-query";

/** Shared client; mounted once by QueryProvider, cleared on sign-out. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/** Sign-out wipe: a second account in the same browser must never see the
 * first account's data (ADR-0001; called by the auth provider). */
export function clearSessionCache(): void {
  queryClient.clear();
}
