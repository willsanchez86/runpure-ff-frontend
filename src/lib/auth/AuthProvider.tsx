/** Auth context (foundation spec §5): Google sign-in via Firebase (F4), or a
 * clearly labelled stub session when Firebase env is absent (local sample mode,
 * spec §6.4) so the shell and states are buildable before the project exists. */
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getFirebaseAuth, isFirebaseConfigured } from "./firebase";

/** The signed-in account as the shell displays it. */
export interface AuthUser {
  name: string;
  email: string;
}

/** Auth lifecycle: loading until the session source answers once. */
export type AuthStatus = "loading" | "signedOut" | "signedIn";

interface Session {
  status: AuthStatus;
  user: AuthUser | null;
}

interface AuthContextValue extends Session {
  /** False in sample mode (no Firebase env); the sign-in screen says so. */
  configured: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STUB_KEY = "ffw-stub-session";
const STUB_USER: AuthUser = { name: "Sample Owner", email: "sample@local" };

/** Mounts once in the root layout; every screen reads auth through useAuth(). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({
    status: "loading",
    user: null,
  });

  useEffect(() => {
    // Subscription-style resolution: state updates happen in async callbacks,
    // never synchronously in the effect body (react-hooks/set-state-in-effect).
    const flags = { cancelled: false };
    let unsubscribe = () => {};
    void (async () => {
      if (!isFirebaseConfigured) {
        const hasStub = sessionStorage.getItem(STUB_KEY) === "1";
        await Promise.resolve();
        if (!flags.cancelled) {
          setSession(
            hasStub
              ? { status: "signedIn", user: STUB_USER }
              : { status: "signedOut", user: null },
          );
        }
        return;
      }
      const auth = await getFirebaseAuth();
      const { onAuthStateChanged } = await import("@firebase/auth");
      if (flags.cancelled) return;
      unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        setSession(
          firebaseUser
            ? {
                status: "signedIn",
                user: {
                  name:
                    firebaseUser.displayName ?? firebaseUser.email ?? "Account",
                  email: firebaseUser.email ?? "",
                },
              }
            : { status: "signedOut", user: null },
        );
      });
    })();
    return () => {
      flags.cancelled = true;
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!isFirebaseConfigured) {
      sessionStorage.setItem(STUB_KEY, "1");
      setSession({ status: "signedIn", user: STUB_USER });
      return;
    }
    const auth = await getFirebaseAuth();
    const { GoogleAuthProvider, signInWithPopup } =
      await import("@firebase/auth");
    await signInWithPopup(auth, new GoogleAuthProvider());
  }, []);

  const signOutUser = useCallback(async () => {
    if (!isFirebaseConfigured) {
      sessionStorage.removeItem(STUB_KEY);
      setSession({ status: "signedOut", user: null });
      return;
    }
    const auth = await getFirebaseAuth();
    const { signOut } = await import("@firebase/auth");
    await signOut(auth);
  }, []);

  const value = useMemo(
    () => ({
      ...session,
      configured: isFirebaseConfigured,
      signInWithGoogle,
      signOutUser,
    }),
    [session, signInWithGoogle, signOutUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Reads the auth context; throws outside AuthProvider (a wiring bug). */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
