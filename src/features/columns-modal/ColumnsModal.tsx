/** Columns & filters modal (player spec §7): draft-based — edits stage into a
 * draft; Apply commits (sort preserved), Reset restores defaults, Cancel/ESC
 * discards. Free agents / Watchlist stay visible-but-disabled (no league). */
"use client";

import { useState } from "react";
import { Modal } from "@/components/overlay/Modal";
import type { SeasonModel } from "@/lib/scoring/types";
import {
  colsKeyFor,
  colsOffered,
  defaultSettings,
  type PosFilter,
  type Settings,
} from "@/lib/settings/model";
import { useSettings } from "@/lib/settings/SettingsProvider";
import { CAT_ORDER, COLS, PRESETS } from "@/features/players/columns";
import pstyles from "@/features/players/players.module.css";
import styles from "./columns.module.css";

// IDP removed from Phase 1 (owner, 2026-11-17)
const POS_OPTIONS: PosFilter[] = [
  "ALL",
  "QB",
  "RB",
  "WR",
  "TE",
  "K",
  "DEF",
  "FLEX",
];

type Draft = Pick<
  Settings,
  | "posFilter"
  | "teamFilter"
  | "injFilter"
  | "byeFilter"
  | "minGp"
  | "range"
  | "cwkFrom"
  | "cwkTo"
  | "rookieOnly"
  | "compact"
  | "cols"
  | "colsK"
  | "colsDEF"
  | "colsIDP"
>;

/** The modal; mounts only while open. */
export function ColumnsModal({
  model,
  onClose,
}: {
  model: SeasonModel;
  onClose: () => void;
}) {
  const { settings, update } = useSettings();
  // edits stage into this draft; nothing applies until Apply commits it
  const [draft, setDraft] = useState<Draft>({
    posFilter: settings.posFilter,
    teamFilter: settings.teamFilter,
    injFilter: settings.injFilter,
    byeFilter: settings.byeFilter,
    minGp: settings.minGp,
    range: settings.range,
    cwkFrom: settings.cwkFrom,
    cwkTo: settings.cwkTo,
    rookieOnly: settings.rookieOnly,
    compact: settings.compact,
    cols: [...settings.cols],
    colsK: [...settings.colsK],
    colsDEF: [...settings.colsDEF],
    colsIDP: [...settings.colsIDP],
  });
  const patch = (changes: Partial<Draft>) => {
    setDraft((prev) => ({ ...prev, ...changes }));
  };

  const activeKey = colsKeyFor(draft.posFilter);
  const offered = colsOffered(activeKey);
  const activeCols = draft[activeKey];
  const byes = [
    ...new Set([...model.teamsByAbbr.values()].map((team) => team.byeWeek)),
  ].sort((first, byeWeek) => first - byeWeek);
  const teams = [...model.teamsByAbbr.values()].sort((first, byeWeek) =>
    first.abbr.localeCompare(byeWeek.abbr),
  );

  const toggleCol = (key: string) => {
    const has = activeCols.includes(key);
    const next = has
      ? activeCols.filter((colKey) => colKey !== key)
      : [...activeCols, key];
    // keep catalog order
    // keep catalog order regardless of toggle order
    const ordered = offered.filter((colKey) => next.includes(colKey));
    patch({ [activeKey]: ordered });
  };

  // Apply commits the whole draft at once; sort survives (PRD)
  const apply = () => {
    update(draft); // sort intentionally untouched (PRD: toggling keeps sort)
    onClose();
  };
  // Reset restores factory defaults into the draft (still needs Apply)
  const reset = () => {
    const factory = defaultSettings(model.playedWeeks);
    setDraft({
      posFilter: "ALL",
      teamFilter: "ALL",
      injFilter: "ALL",
      byeFilter: "ALL",
      minGp: 0,
      range: "season",
      cwkFrom: 1,
      cwkTo: model.playedWeeks,
      rookieOnly: false,
      compact: false,
      cols: [...factory.cols],
      colsK: [...factory.colsK],
      colsDEF: [...factory.colsDEF],
      colsIDP: [...factory.colsIDP],
    });
  };

  return (
    <Modal label="Columns and filters" onClose={onClose} centered>
      <div className={styles.head}>
        <b>Columns &amp; filters</b>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>
      <div className={styles.body}>
        <div className={styles.grid}>
          <div>
            <h3>Filters</h3>
            <div className={styles.filters}>
              <label className={styles.field}>
                Position
                <select
                  className={pstyles.select}
                  value={draft.posFilter}
                  onChange={(event) => {
                    patch({ posFilter: event.target.value as PosFilter });
                  }}
                >
                  {POS_OPTIONS.map((posOption) => (
                    <option key={posOption} value={posOption}>
                      {posOption === "ALL" ? "All positions" : posOption}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                Team
                <select
                  className={pstyles.select}
                  value={draft.teamFilter}
                  onChange={(event) => {
                    patch({ teamFilter: event.target.value });
                  }}
                >
                  <option value="ALL">All teams</option>
                  {teams.map((team) => (
                    <option key={team.abbr} value={team.abbr}>
                      {team.abbr} — {team.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                Injury status
                <select
                  className={pstyles.select}
                  value={draft.injFilter}
                  onChange={(event) => {
                    patch({
                      injFilter: event.target.value as Draft["injFilter"],
                    });
                  }}
                >
                  <option value="ALL">Any</option>
                  <option value="HEALTHY">Healthy only</option>
                  <option value="Q">Questionable</option>
                  <option value="O">Out</option>
                  <option value="IR">Injured reserve</option>
                </select>
              </label>
              <label className={styles.field}>
                Bye week
                <select
                  className={pstyles.select}
                  value={String(draft.byeFilter)}
                  onChange={(event) => {
                    patch({
                      byeFilter:
                        event.target.value === "ALL"
                          ? "ALL"
                          : Number(event.target.value),
                    });
                  }}
                >
                  <option value="ALL">Any</option>
                  {byes.map((byeWeek) => (
                    <option key={byeWeek} value={byeWeek}>
                      Week {byeWeek}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                Min games played
                <input
                  type="number"
                  className={pstyles.select}
                  min={0}
                  max={model.playedWeeks}
                  value={draft.minGp}
                  onChange={(event) => {
                    patch({ minGp: Number(event.target.value) });
                  }}
                />
              </label>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={draft.rookieOnly}
                  onChange={(event) => {
                    patch({ rookieOnly: event.target.checked });
                  }}
                />
                Rookies only
              </label>
              <label
                className={`${styles.check} ${styles.soon}`}
                title="Needs first connected league — later phase"
              >
                <input type="checkbox" disabled /> Free agents
                <span className={pstyles.soontag}>soon</span>
              </label>
              <label
                className={`${styles.check} ${styles.soon}`}
                title="Arrives in first later phase"
              >
                <input type="checkbox" disabled /> Watchlist
                <span className={pstyles.soontag}>soon</span>
              </label>
            </div>
            <div className={styles.display}>
              <div className={styles.cft}>Display</div>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={draft.compact}
                  onChange={(event) => {
                    patch({ compact: event.target.checked });
                  }}
                />
                Compact rows
              </label>
              <p className={styles.note}>Projections — coming later.</p>
            </div>
          </div>
          <div>
            <h3>Columns</h3>
            <div className={styles.view}>
              <div className={styles.cft}>View preset</div>
              <div className={styles.viewrow}>
                {Object.entries(PRESETS).map(([name, keys]) => (
                  <button
                    key={name}
                    type="button"
                    className={pstyles.pill}
                    onClick={() => {
                      patch({
                        [activeKey]: offered.filter((colKey) =>
                          keys.includes(colKey),
                        ),
                      });
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
            {/* checkboxes grouped by category, limited to the position's columns */}
            {CAT_ORDER.map((cat) => {
              const inCat = offered.filter(
                (colKey) => COLS[colKey]?.cat === cat,
              );
              if (!inCat.length) return null;
              return (
                <div key={cat} className={styles.cat}>
                  <div className={styles.cft}>{cat}</div>
                  <div className={styles.cols}>
                    {inCat.map((colKey) => (
                      <label key={colKey} className={styles.col}>
                        <input
                          type="checkbox"
                          checked={activeCols.includes(colKey)}
                          onChange={() => {
                            toggleCol(colKey);
                          }}
                        />
                        {COLS[colKey]?.lab}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className={styles.actions}>
          <button type="button" className={pstyles.btn} onClick={reset}>
            Reset to defaults
          </button>
          <span style={{ marginLeft: "auto" }} />
          <button type="button" className={pstyles.btn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`${pstyles.btn} ${pstyles.btnPrimary}`}
            onClick={apply}
          >
            Apply
          </button>
        </div>
      </div>
    </Modal>
  );
}
