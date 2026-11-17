/** Settings state (foundation spec §2.1/§8): one context over a reducer-style
 * updater. The localStorage mirror restores instantly on boot; the server copy
 * is the record once the saveSettings mutation exists (F7 — until then the
 * mirror alone runs behind this same interface). Persistence is a subscriber
 * side-effect here, never written from UI code. */
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { defaultSettings, sanitizeSettings, type Settings } from "./model";

const MIRROR_KEY = "ffw-settings";
const DEFAULT_PLAYED_WEEKS = 18;

interface SettingsContextValue {
  settings: Settings;
  /** Applies a partial update; persistence follows automatically. */
  update: (patch: Partial<Settings>) => void;
  /** Resets every filter + search (the list's "Clear all"). */
  clearFilters: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/** Mounts inside the authenticated area (settings are per account). */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() =>
    defaultSettings(DEFAULT_PLAYED_WEEKS),
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // boot: restore the mirror (client only), sanitized
  useEffect(() => {
    let raw: unknown = null;
    try {
      raw = JSON.parse(localStorage.getItem(MIRROR_KEY) ?? "null");
    } catch {
      raw = null;
    }
    if (raw !== null) {
      const next = sanitizeSettings(raw, DEFAULT_PLAYED_WEEKS);
      queueMicrotask(() => {
        setSettings(next);
      });
    }
  }, []);

  const persist = useCallback((next: Settings) => {
    try {
      localStorage.setItem(MIRROR_KEY, JSON.stringify(next));
    } catch {
      /* mirror is best-effort */
    }
    // server save: debounced saveSettings mutation lands at contract cut-over
    // debounce: rapid control changes collapse into one (future) server save
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
    }, 1000);
  }, []);

  const update = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const clearFilters = useCallback(() => {
    update({
      posFilter: "ALL",
      teamFilter: "ALL",
      injFilter: "ALL",
      byeFilter: "ALL",
      minGp: 0,
      rookieOnly: false,
      query: "",
    });
  }, [update]);

  const value = useMemo(
    () => ({ settings, update, clearFilters }),
    [settings, update, clearFilters],
  );
  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

/** Reads settings; throws outside the provider (a wiring bug). */
export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
