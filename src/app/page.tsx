/** Placeholder home for the repo-init slice (foundation spec §13 step 1).
 * Becomes a redirect to /players when the shell lands (§2 routes, P1). */
import styles from "./page.module.css";

/** Temporary landing page proving the toolchain end to end. */
export default function Home() {
  return (
    <main className={styles.main}>
      <h1 className={styles.hero}>Fantasy Workbench</h1>
      <p className={styles.note}>
        Runpure FF · Phase 1. The Players and NFL screens arrive per the
        planning repo&apos;s frontend specs.
      </p>
    </main>
  );
}
