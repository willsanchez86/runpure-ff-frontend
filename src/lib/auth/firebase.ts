/** Firebase client bootstrap (ADR-0015; foundation spec §5, decision F4).
 * The SDK is imported lazily so sample mode (no Firebase env) ships no Firebase
 * code at runtime. All config values are build-time public (spec §4). */
import type { Auth } from "@firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** True when every Firebase public config value is present at build time. */
export const isFirebaseConfigured: boolean = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId,
);

/** Returns the lazily initialized Firebase Auth instance. Callers must check
 * `isFirebaseConfigured` first; throws when called unconfigured. */
export async function getFirebaseAuth(): Promise<Auth> {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured (see .env.example).");
  }
  const { initializeApp, getApps } = await import("@firebase/app");
  const { getAuth } = await import("@firebase/auth");
  const app = getApps()[0] ?? initializeApp(config);
  return getAuth(app);
}
