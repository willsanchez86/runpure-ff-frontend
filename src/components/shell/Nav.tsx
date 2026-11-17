/** Left navigation (foundation spec §10): Players and NFL live; the four
 * later-phase items are visible but non-clickable "soon" stubs (no dead ends,
 * interface design brief); dashed league-picker placeholder for later phases. */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Nav.module.css";

const LIVE_ITEMS = [
  { href: "/players", label: "Players" },
  { href: "/nfl", label: "NFL" },
] as const;

const SOON_ITEMS = [
  "Game day",
  "Waivers & trades",
  "Weekly review",
  "Leagues",
] as const;

/** The shell's left nav; collapses to a horizontal bar ≤980 px (CSS). */
export function Nav() {
  const pathname = usePathname();
  return (
    <nav className={styles.nav} aria-label="Primary">
      <div className={styles.brand}>
        <span className={styles.mark} aria-hidden>
          FW
        </span>
        <span>
          <b>Fantasy Workbench</b>
          <span className={styles.brandSub}>Runpure FF · Phase 1</span>
        </span>
      </div>

      <div className={styles.sec}>Browse</div>
      {LIVE_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={
            pathname.startsWith(item.href)
              ? `${styles.item} ${styles.on}`
              : styles.item
          }
          aria-current={pathname.startsWith(item.href) ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}

      <div className={styles.sec}>Coming later</div>
      {SOON_ITEMS.map((label) => (
        <span
          key={label}
          className={`${styles.item} ${styles.soon}`}
          aria-disabled="true"
          title="Planned for a later phase"
        >
          {label}
          <span className={styles.tag}>soon</span>
        </span>
      ))}

      <div className={styles.leaguePick}>
        No leagues connected. League features arrive in a later phase.
      </div>

      <div className={styles.foot}>
        Phase 1 shows NFL data only, refreshed daily. No league accounts are
        connected.
      </div>
    </nav>
  );
}
