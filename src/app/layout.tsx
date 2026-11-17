/** Root layout (foundation spec §2): dark shell base; tokens.css is the global
 * custom-property layer (ADR-0018). System font stack only — no web fonts
 * (design-language.md). AuthProvider mounts once here (spec §5). */
import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import "../styles/tokens.css";
import "./globals.css";

/** App-wide document metadata. */
export const metadata: Metadata = {
  title: "Fantasy Workbench",
  description:
    "Runpure FF — every NFL player and game from daily public data. Phase 1.",
};

/** Wraps every route; the authenticated app shell mounts inside this. */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
