/** Top bar (foundation spec §10): data-freshness note and the account chip
 * with its menu. Freshness shows a placeholder until the data layer lands
 * (spec §6.3 wires it to the contract's dataFreshness field). */
"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import styles from "./TopBar.module.css";

const SAMPLE_MODE = process.env.NEXT_PUBLIC_DATA_SOURCE !== "api";

/** Sticky bar above every screen; collapses per the prototype's breakpoints. */
export function TopBar() {
  const { user, signOutUser } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const initials = (user?.name ?? "?")
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className={styles.topbar}>
      <span className={styles.fresh}>
        <span className={styles.dot} aria-hidden />
        <span className={styles.freshTxt}>
          {SAMPLE_MODE
            ? "Sample data · daily refresh arrives with the API"
            : "NFL data · updated daily by 06:00 ET"}
        </span>
      </span>
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
