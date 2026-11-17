/** Sign-in screen (foundation spec §5, decision F4): Google only — the
 * prototype's email form and Apple button are not built. In sample mode
 * (no Firebase env) the button starts a labelled stub session instead. */
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import styles from "./page.module.css";

/** The only screen that renders signed out; redirects in when a session exists. */
export default function SignInPage() {
  const { status, configured, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // an existing session skips the sign-in screen entirely
    if (status === "signedIn") router.replace("/players");
  }, [status, router]);

  // render only in the signed-out state; loading stays blank
  if (status !== "signedOut") return null;

  const onSignIn = () => {
    setBusy(true);
    setError(null);
    // popup failure surfaces inline and re-enables the button
    signInWithGoogle().catch((err: unknown) => {
      setBusy(false);
      setError(
        err instanceof Error ? err.message : "Sign-in failed. Try again.",
      );
    });
  };

  return (
    <div className={styles.signin}>
      <div className={styles.box}>
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden>
            FW
          </span>
          <span>
            <b>Fantasy Workbench</b>
            <span className={styles.brandSub}>Runpure FF · Phase 1</span>
          </span>
        </div>
        <div className={styles.panel}>
          <h1>Sign in</h1>
          <p className={styles.lede}>Every screen needs a signed-in account.</p>
          <button
            type="button"
            className={styles.provider}
            onClick={onSignIn}
            disabled={busy}
          >
            {configured ? "Continue with Google" : "Continue (sample mode)"}
          </button>
          {!configured && (
            <p className={styles.hint}>
              Firebase isn&apos;t configured in this build; a labelled sample
              session is used instead (see .env.example).
            </p>
          )}
          {error && (
            <p className={styles.err} role="alert">
              {error}
            </p>
          )}
        </div>
        <p className={styles.foot}>
          Invite only — accounts are created by the owner. No public sign-up.
        </p>
      </div>
    </div>
  );
}
