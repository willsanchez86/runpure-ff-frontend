/** "No account" state (foundation spec §2/§5): signed into Firebase but `me`
 * is null — accounts are created manually (system design §3). Shows a plain
 * message, fetches no data, offers sign-out. */
"use client";

import type { ReactNode } from "react";
import { useMe } from "@/lib/api/hooks";
import { useAuth } from "./AuthProvider";
import styles from "./AccountGate.module.css";

/** Sits inside RequireAuth, around the app shell's content. */
export function AccountGate({ children }: { children: ReactNode }) {
  const me = useMe();
  const { signOutUser } = useAuth();

  // no flash of content while the account check runs
  if (me.isLoading) return null;
  if (me.isError) {
    return (
      <div className={styles.wrap}>
        <div className={styles.panel} role="alert">
          <h1>Couldn&apos;t check your account</h1>
          <p>
            {me.error instanceof Error
              ? me.error.message
              : "The API can't be reached."}
          </p>
          <button
            type="button"
            className={styles.btn}
            onClick={() => {
              void me.refetch();
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  // signed into Firebase but no app account row: message only, no data
  if (me.data === null) {
    return (
      <div className={styles.wrap}>
        <div className={styles.panel}>
          <h1>Your account isn&apos;t set up yet</h1>
          <p>
            You&apos;re signed in, but this app is invite-only and your account
            hasn&apos;t been created. No data is shown until it is.
          </p>
          <button
            type="button"
            className={styles.btn}
            onClick={() => {
              void signOutUser();
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
