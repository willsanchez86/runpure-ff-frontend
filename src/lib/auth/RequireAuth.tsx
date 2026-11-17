/** Route guard (foundation spec §2 states): signed-out visitors to any app
 * screen are sent to /sign-in; nothing renders (and no data is fetched)
 * until the session answers. */
"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "./AuthProvider";

/** Wraps the authenticated (app) layout. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "signedOut") router.replace("/sign-in");
  }, [status, router]);

  if (status !== "signedIn") return null;
  return <>{children}</>;
}
