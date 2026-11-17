/** App shell (foundation spec §10): left nav + top bar around every screen.
 * Layout ported from the prototype (.app grid, 216px nav, sticky top bar). */
import type { ReactNode } from "react";
import styles from "./AppShell.module.css";
import { Nav } from "./Nav";
import { TopBar } from "./TopBar";

/** Grid wrapper every authenticated route renders inside. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.app}>
      <a href="#main" className="sr-only">
        Skip to content
      </a>
      <Nav />
      <main className={styles.main}>
        <TopBar />
        <div id="main" className={styles.view}>
          {children}
        </div>
      </main>
    </div>
  );
}
