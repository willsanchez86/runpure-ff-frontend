/** The player table (player spec §4; ADR-0020): hand-rolled sorting,
 * position-specific column sets, grouped headers, and fixed-height row
 * virtualization — render only the visible window of the full filtered list. */
"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { Player } from "@/lib/api/contract";
import { matchup } from "@/lib/scoring/engine";
import type { SeasonModel } from "@/lib/scoring/types";
import { colsKeyFor } from "@/lib/settings/model";
import { useSettings } from "@/lib/settings/SettingsProvider";
import { Avatar, InjuryWord, PosTag } from "./cells";
import { COLS, type ColCtx, type ColDef } from "./columns";
import type { Row } from "./filtering";
import { sortRows } from "./filtering";
import styles from "./players.module.css";

// rows rendered beyond each edge of the viewport so fast scrolls stay filled
const OVERSCAN = 8;
const COMPARE_CAP = 4;

/** Group-header spans for the active columns (player spec §4.1). */
function groupSpans(cols: ColDef[]): { cat: string; span: number }[] {
  const out: { cat: string; span: number }[] = [];
  for (const col of cols) {
    const last = out.at(-1);
    if (last && last.cat === col.cat) last.span++;
    else out.push({ cat: col.cat, span: 1 });
  }
  return out;
}

/** The virtualized, sortable table. */
export function PlayersTable({
  model,
  rows,
  ticked,
  onTick,
  onOpen,
}: {
  model: SeasonModel;
  rows: Row[];
  ticked: string[];
  onTick: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const { settings, update } = useSettings();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // K/DEF/IDP swap in their own column sets (player spec 4.2)
  const activeKey = colsKeyFor(settings.posFilter);
  const cols = useMemo(
    () =>
      settings[activeKey]
        .map((colKey) => COLS[colKey])
        .filter((candidate): candidate is ColDef => candidate != null),
    [settings, activeKey],
  );
  const ctx: ColCtx = useMemo(() => ({ model, settings }), [model, settings]);

  const [sortKey, sortDir] = settings.sort;
  // sorting re-runs only when rows, the sort, or the context change
  const sorted = useMemo(() => {
    const col = COLS[sortKey];
    const copy = [...rows];
    if (!col) return copy;
    return sortRows(copy, (row) => col.get(row, ctx), sortDir);
  }, [rows, sortKey, sortDir, ctx]);

  const onHeaderClick = useCallback(
    (col: ColDef) => {
      const defaultDir: 1 | -1 = col.asc ? 1 : -1;
      // same column: second click reverses; new column: its default direction
      const next: [string, 1 | -1] =
        sortKey === col.key
          ? [col.key, sortDir === 1 ? -1 : 1]
          : [col.key, defaultDir];
      update({ sort: next });
    },
    [sortKey, sortDir, update],
  );

  // fixed-height windowing (PE1): exact arithmetic, ~80 lines total
  const rowH = settings.compact ? 30 : 38;
  const viewH = 640;
  // fixed row height makes the visible window pure arithmetic
  const first = Math.max(0, Math.floor(scrollTop / rowH) - OVERSCAN);
  const visibleCount = Math.ceil(viewH / rowH) + OVERSCAN * 2;
  const last = Math.min(sorted.length, first + visibleCount);
  // spacer heights keep the scrollbar sized as if every row were rendered
  const topPad = first * rowH;
  const bottomPad = Math.max(0, (sorted.length - last) * rowH);
  const window = sorted.slice(first, last);

  const totalCols = cols.length + 3;

  return (
    <div className={styles.card}>
      <div
        ref={scrollerRef}
        className={styles.scroller}
        onScroll={() => {
          setScrollTop(scrollerRef.current?.scrollTop ?? 0);
        }}
      >
        <table
          className={styles.t}
          style={{ ["--rowh" as string]: `${String(rowH)}px` }}
          aria-rowcount={sorted.length}
        >
          <thead>
            <tr className="grouprow">
              <th className="blank ns l" colSpan={3} />
              {groupSpans(cols).map((group, index) => (
                <th
                  key={index}
                  className={group.cat ? "grp" : "blank"}
                  colSpan={group.span}
                >
                  {group.cat}
                </th>
              ))}
            </tr>
            <tr>
              <th className={`ns ${styles.tickCell}`} aria-label="Select" />
              <th className="l ns">Player</th>
              <th className="l ns">Pos</th>
              {cols.map((col) => {
                const isSorted = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    className={`${col.left ? "l " : ""}${isSorted ? "sorted" : ""}`}
                    title={col.tip}
                    aria-sort={
                      isSorted
                        ? sortDir === 1
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                    onClick={() => {
                      onHeaderClick(col);
                    }}
                  >
                    {col.lab}
                    {isSorted && (
                      <span className={styles.caret} aria-hidden>
                        {sortDir === 1 ? "▲" : "▼"}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {topPad > 0 && (
              <tr className={styles.spacerRow} aria-hidden>
                <td colSpan={totalCols} style={{ height: topPad }} />
              </tr>
            )}
            {/* only the visible window of rows is rendered (PE1) */}
            {window.map((row) => (
              <PlayerRow
                key={row.player.id}
                row={row}
                cols={cols}
                ctx={ctx}
                model={model}
                ticked={ticked.includes(row.player.id)}
                tickDisabled={
                  ticked.length >= COMPARE_CAP &&
                  !ticked.includes(row.player.id)
                }
                onTick={onTick}
                onOpen={onOpen}
              />
            ))}
            {bottomPad > 0 && (
              <tr className={styles.spacerRow} aria-hidden>
                <td colSpan={totalCols} style={{ height: bottomPad }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Row anatomy (player spec §4.5): tick · stubs · avatar · name+injury ·
 * subline · pos tag · stat cells. Click opens the card. */
function PlayerRow({
  row,
  cols,
  ctx,
  model,
  ticked,
  tickDisabled,
  onTick,
  onOpen,
}: {
  row: Row;
  cols: ColDef[];
  ctx: ColCtx;
  model: SeasonModel;
  ticked: boolean;
  tickDisabled: boolean;
  onTick: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const player: Player = row.player;
  const bye = player.team ? model.teamsByAbbr.get(player.team)?.byeWeek : null;
  const next = model.isCurrent
    ? matchup(model, player.team, player.position, model.currentWeek)
    : null;
  return (
    <tr
      className={`${styles.rowClickable} ${ticked ? styles.rowTicked : ""}`}
      onClick={() => {
        onOpen(player.id);
      }}
    >
      <td
        className={styles.tickCell}
        onClick={(event) => {
          // ticking must not also open the player card
          event.stopPropagation();
        }}
      >
        <input
          type="checkbox"
          checked={ticked}
          disabled={tickDisabled}
          aria-label={`Select ${player.name} to compare`}
          onChange={() => {
            onTick(player.id);
          }}
        />
      </td>
      <td className="l">
        <span className={styles.pcell}>
          <button
            type="button"
            className={`${styles.stub} ${styles.stubAdd}`}
            disabled
            title="Add to roster — needs a connected league (later phase)"
          >
            +
          </button>
          <button
            type="button"
            className={`${styles.stub} ${styles.stubStar}`}
            disabled
            title="Watchlist — arrives in a later phase"
          >
            ★
          </button>
          <Avatar name={player.name} id={player.id} />
          <span className={styles.who}>
            <span className={styles.pname}>
              {player.name}
              {model.isCurrent && (
                <InjuryWord
                  status={player.injuryStatus}
                  practice={player.practiceStatus}
                />
              )}
            </span>
            <span className={styles.psub}>
              {player.position} - {player.team ?? "FA"}
              {bye ? `(${String(bye)})` : ""}
              {next ? ` · vs ${next.opponent}` : ""}
            </span>
          </span>
        </span>
      </td>
      <td className="l">
        <PosTag pos={player.position} />
      </td>
      {cols.map((col) => (
        <td key={col.key} className={col.left ? "l" : undefined}>
          {col.render(row, ctx)}
        </td>
      ))}
    </tr>
  );
}
