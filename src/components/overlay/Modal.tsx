/** Overlay manager (foundation spec §10): one scrim overlay at a time, dialog
 * semantics, ESC + scrim-click close, focus trapped inside and returned to the
 * opener on close. Deferred from step 2 to its first consumer (the card). */
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./overlay.module.css";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Scrim + dialog. `wide` centers a 980px panel (compare/columns); default is
 * the right-side 1060px card panel. */
export function Modal({
  label,
  onClose,
  children,
  centered,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
  centered?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    // remember the opener so focus returns to it on close
    openerRef.current = document.activeElement;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      // focus trap: cycle within the dialog
      const nodes = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = nodes.at(0);
      const last = nodes.at(-1);
      if (!first || !last) return;
      // Tab wraps at the dialog's edges: focus never escapes while open
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      const opener = openerRef.current;
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [onClose]);

  return (
    <div
      className={`${styles.scrim} ${centered ? styles.centered : ""}`}
      onMouseDown={(event) => {
        // clicks on the scrim itself close; clicks inside the panel don't
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`${styles.panel} ${centered ? styles.panelCentered : ""}`}
      >
        {children}
      </div>
    </div>
  );
}
