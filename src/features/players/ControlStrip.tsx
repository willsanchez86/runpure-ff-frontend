/** The two-row control strip (player spec §3): search · season · ⋯ stubs ·
 * position pills · Scoring ▾ · Range ▾ · ⚙ Columns & filters badge. Every
 * control persists through settings (F7) except the season (session, PE3). */
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SEASONS } from "@/lib/api/sources";
import type { SeasonModel } from "@/lib/scoring/types";
import type { PosFilter } from "@/lib/settings/model";
import { useSettings } from "@/lib/settings/SettingsProvider";
import styles from "./players.module.css";

const PILLS: PosFilter[] = ["ALL", "QB", "RB", "WR", "TE", "K", "DEF"];
// IDP options removed from Phase 1 (owner, 2026-11-17)
const MORE: { v: PosFilter; label: string }[] = [
  { v: "FLEX", label: "FLEX · RB/WR/TE" },
];

/** A dropdown shell: button + panel, outside-click/ESC close. */
function Dropdown({
  label,
  right,
  children,
}: {
  label: ReactNode;
  right?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    // outside click or Escape closes the open panel
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className={styles.ddwrap} ref={ref}>
      <button
        type="button"
        className={styles.btn}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((wasOpen) => !wasOpen);
        }}
      >
        {label} <span aria-hidden>▾</span>
      </button>
      {open && (
        <div
          className={`${styles.ddpanel} ${right ? styles.ddright : ""}`}
          role="menu"
        >
          {children}
        </div>
      )}
    </div>
  );
}

function RadioOpt({
  on,
  children,
  onClick,
}: {
  on: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={on}
      className={`${styles.ddopt} ${on ? styles.ddoptOn : ""}`}
      onClick={onClick}
    >
      <span className={styles.rdot} aria-hidden />
      {children}
    </button>
  );
}

/** The whole strip; `filterCount` feeds the ⚙ badge. */
export function ControlStrip({
  model,
  season,
  onSeason,
  filterCount,
  onOpenColumns,
}: {
  model: SeasonModel;
  season: number;
  onSeason: (s: number) => void;
  filterCount: number;
  onOpenColumns: () => void;
}) {
  const { settings, update } = useSettings();
  // button label mirrors the active scoring so state is visible at rest
  const fmtLabel =
    settings.fmt === "ppr"
      ? "Full PPR"
      : settings.fmt === "half"
        ? "Half PPR"
        : "Standard";
  const maxWeek = Math.max(1, model.playedWeeks);

  return (
    <>
      <div className={styles.toolbar}>
        <span className={styles.search}>
          <svg className={styles.searchIcon} viewBox="0 0 16 16" aria-hidden>
            <circle
              cx="7"
              cy="7"
              r="4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path
              d="M10.5 10.5 14 14"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          <input
            type="search"
            value={settings.query}
            placeholder="Search players or a team code"
            aria-label="Search players by name, or a team code"
            onChange={(event) => {
              update({ query: event.target.value });
            }}
          />
        </span>
        <select
          className={styles.select}
          value={season}
          aria-label="Season"
          onChange={(event) => {
            onSeason(Number(event.target.value));
          }}
        >
          {/* newest season first; switching fetches that season on demand (PE3) */}
          {[...SEASONS].reverse().map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <Dropdown label="⋯" right>
          <div className={styles.ddsec}>More actions</div>
          <button
            type="button"
            className={`${styles.ddopt} ${styles.soonitem}`}
            disabled
          >
            Saved views <span className={styles.soontag}>soon</span>
          </button>
          <button
            type="button"
            className={`${styles.ddopt} ${styles.soonitem}`}
            disabled
          >
            Export <span className={styles.soontag}>soon</span>
          </button>
        </Dropdown>
      </div>

      <div className={styles.toolbar}>
        <span
          className={styles.pillrow}
          role="group"
          aria-label="Position filter"
        >
          {PILLS.map((value) => (
            <button
              key={value}
              type="button"
              className={`${styles.pill} ${settings.posFilter === value ? styles.pillOn : ""}`}
              aria-pressed={settings.posFilter === value}
              onClick={() => {
                update({ posFilter: value });
              }}
            >
              {value === "ALL" ? "All" : value}
            </button>
          ))}
          <Dropdown
            label={
              MORE.some((option) => option.v === settings.posFilter)
                ? (MORE.find((option) => option.v === settings.posFilter)?.v ??
                  "More")
                : "More"
            }
          >
            {MORE.map((option) => (
              <RadioOpt
                key={option.v}
                on={settings.posFilter === option.v}
                onClick={() => {
                  update({ posFilter: option.v });
                }}
              >
                {option.label}
              </RadioOpt>
            ))}
          </Dropdown>
        </span>

        <Dropdown
          label={
            <>
              <span className="dim">Scoring</span> {fmtLabel}
              {settings.tePrem ? " · TE+" : ""}
              {settings.ptd6 ? " · 6pt" : ""}
            </>
          }
        >
          <div className={styles.ddsec}>Format</div>
          {(
            [
              ["ppr", "Full PPR"],
              ["half", "Half PPR"],
              ["std", "Standard"],
            ] as const
          ).map(([value, label]) => (
            <RadioOpt
              key={value}
              on={settings.fmt === value}
              onClick={() => {
                update({ fmt: value });
              }}
            >
              {label}
            </RadioOpt>
          ))}
          <div className={styles.ddsep} />
          <label className={styles.ddchk}>
            <input
              type="checkbox"
              checked={settings.tePrem}
              onChange={(event) => {
                update({ tePrem: event.target.checked });
              }}
            />
            TE premium (+0.5/rec for TE)
          </label>
          <label className={styles.ddchk}>
            <input
              type="checkbox"
              checked={settings.ptd6}
              onChange={(event) => {
                update({ ptd6: event.target.checked });
              }}
            />
            6-pt passing TDs
          </label>
        </Dropdown>

        <Dropdown
          label={
            <>
              <span className="dim">Range</span>{" "}
              {settings.range === "custom"
                ? `Weeks ${String(Math.min(settings.cwkFrom, settings.cwkTo))}–${String(Math.max(settings.cwkFrom, settings.cwkTo))}`
                : "Full season"}
              {settings.perGame ? " · per-game" : ""}
            </>
          }
        >
          <RadioOpt
            on={settings.range === "season"}
            onClick={() => {
              update({ range: "season" });
            }}
          >
            Season
          </RadioOpt>
          <RadioOpt
            on={settings.range === "custom"}
            onClick={() => {
              update({ range: "custom" });
            }}
          >
            Custom weeks
          </RadioOpt>
          {/* week inputs appear only when Custom is picked */}
          {settings.range === "custom" && (
            <div className={styles.ddcustom}>
              From
              <input
                type="number"
                min={1}
                max={maxWeek}
                value={settings.cwkFrom}
                aria-label="Range from week"
                onChange={(event) => {
                  update({ cwkFrom: Number(event.target.value) });
                }}
              />
              To
              <input
                type="number"
                min={1}
                max={maxWeek}
                value={settings.cwkTo}
                aria-label="Range to week"
                onChange={(event) => {
                  update({ cwkTo: Number(event.target.value) });
                }}
              />
            </div>
          )}
          <div className={styles.ddsep} />
          <label className={styles.ddchk}>
            <input
              type="checkbox"
              checked={settings.perGame}
              onChange={(event) => {
                update({ perGame: event.target.checked });
              }}
            />
            Per game (counting stats)
          </label>
        </Dropdown>

        <button type="button" className={styles.btn} onClick={onOpenColumns}>
          ⚙ Columns &amp; filters
          {filterCount > 0 && (
            <span className={styles.cfbadge}>{filterCount}</span>
          )}
        </button>
      </div>
    </>
  );
}
