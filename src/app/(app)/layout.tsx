/** Authenticated route group (foundation spec §2): every screen inside is
 * guarded and rendered within the app shell. */
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { AccountGate } from "@/lib/auth/AccountGate";
import { RequireAuth } from "@/lib/auth/RequireAuth";
import { SettingsProvider } from "@/lib/settings/SettingsProvider";

/** Guard + shell for /players and /nfl; settings are per account (F7). */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <AppShell>
        <AccountGate>
          <SettingsProvider>{children}</SettingsProvider>
        </AccountGate>
      </AppShell>
    </RequireAuth>
  );
}
