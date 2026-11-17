/** Top bar (foundation spec §10): data-freshness note and the account chip
 * with its menu. Freshness shows a placeholder until the data layer lands
 * (spec §6.3 wires it to the contract's dataFreshness field). */
"use client";

import { useEffect, useRef, useState } from "react";
import { useFreshness } from "@/lib/api/hooks";
import { IS_SAMPLE_MODE } from "@/lib/api/sources";
import { useAuth } from "@/lib/auth/AuthProvider";
import styles from "./TopBar.module.css";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Renders the freshness note from the contract's dataFreshness field
 * (foundation spec §6.3): last-load time, amber when older than 24 h. */
function freshnessText(loadedAt: string | null | undefined): {
  text: string;
  stale: boolean;
} {
  if (!loadedAt) return { text: "Data freshness unavailable", stale: true };
  const at = new Date(loadedAt);
  // stale = older than the daily 06:00 ET run should ever leave it
  const stale = Date.now() - at.getTime() > DAY_MS;
  const when = at.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
  const prefix = IS_SAMPLE_MODE ? "Sample data" : "NFL data";
  return { text: `${prefix} · updated ${when} ET`, stale };
}

/** The freshness note (always visible, foundation spec §10). */
function FreshNote() {
  const freshness = useFreshness();
  const { text, stale } = freshnessText(freshness.data?.statsLoadedAt);
  return (
    <span
      className={stale ? `${styles.fresh} ${styles.stale}` : styles.fresh}
      title={stale ? "Data is older than 24 hours" : undefined}
    >
      <span className={styles.dot} aria-hidden />
      <span className={styles.freshTxt}>
        {text}
        {stale ? " · stale" : ""}
      </span>
    </span>
  );
}

/** Sticky bar above every screen; collapses per the prototype's breakpoints. */
export function TopBar() {
  const { user, signOutUser } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // listeners exist only while the menu is open
    if (!menuOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // initials from the first letters of up to two name parts
  const initials = (user?.name ?? "?")
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className={styles.topbar}>
      <FreshNote />
      <span className={styles.spacer} />
      <div className={styles.acctWrap} ref={menuRef}>
        <button
          type="button"
          className={styles.acct}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => {
            setMenuOpen((open) => !open);
          }}
        >
          <span className={styles.avatar} aria-hidden>
            {initials}
          </span>
          <span className={styles.who}>
            {user?.name}
            <small>{user?.email}</small>
          </span>
        </button>
        {menuOpen && (
          <div className={styles.menu} role="menu">
            <div className={styles.menuHead}>
              <b>{user?.name}</b>
              <small>{user?.email}</small>
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                void signOutUser();
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
