/** Authenticated route group (foundation spec §2): every screen inside is
 * guarded and rendered within the app shell. */
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/lib/auth/RequireAuth";

/** Guard + shell for /players and /nfl. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}
