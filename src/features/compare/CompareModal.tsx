/** Compare modal (player spec §2 overlays; prototype renderCompare): 2–4
 * ticked players side by side; leader per row gets a soft fill AND an explicit
 * "▲ best" text tag (never colour-only); direction-aware (volatility, INT,
 * points-allowed treat lower as best). Follows the list's scoring and range. */
"use client";

import { useMemo, type ReactNode } from "react";
import { Modal } from "@/components/overlay/Modal";
import { playerRangeStats } from "@/lib/scoring/engine";
import type {
  PlayerRangeStats,
  RangeConfig,
  SeasonModel,
} from "@/lib/scoring/types";
import { Avatar, f1, PosTag, Spark } from "@/features/players/cells";
import pstyles from "@/features/players/players.module.css";
import styles from "./compare.module.css";

interface CmpRow {
  label: string;
  /** lower-is-better rows mark the minimum as best. */
  lo?: boolean;
  value: (
    stats: PlayerRangeStats,
    model: SeasonModel,
    playerId: string,
  ) => number | null;
  format?: (v: number) => string;
}

const SHARED: CmpRow[] = [
  {
    label: "Total pts",
    value: (stats) => (stats.gp ? stats.total : null),
    format: f1,
  },
  { label: "Points/game", value: (stats) => stats.avg, format: f1 },
  { label: "High", value: (stats) => stats.high, format: f1 },
  { label: "Low", value: (stats) => stats.low, format: f1 },
  { label: "Volatility", lo: true, value: (stats) => stats.sd, format: f1 },
  { label: "Games played", value: (stats) => stats.gp },
  {
    label: "Snap %",
    value: (stats) => stats.snap,
    format: (value) => `${String(Math.round(value))}%`,
  },
  {
    label: "Target %",
    value: (stats) => stats.tgt,
    format: (value) => `${value.toFixed(1)}%`,
  },
  {
    label: "Position rank",
    lo: true,
    value: (stats, model, playerId) => model.seasonRank.get(playerId) ?? null,
  },
];

const POS_ROWS: Record<string, CmpRow[]> = {
  QB: [
    { label: "Pass yards", value: (stats) => stats.agg.pyd },
    { label: "Pass TDs", value: (stats) => stats.agg.ptd },
    { label: "Rush yards", value: (stats) => stats.agg.ryd },
  ],
  RB: [
    { label: "Carries", value: (stats) => stats.agg.car },
    { label: "Rush yards", value: (stats) => stats.agg.ryd },
    { label: "Receptions", value: (stats) => stats.agg.rec },
    { label: "Rec yards", value: (stats) => stats.agg.cyd },
  ],
  WR: [
    { label: "Targets", value: (stats) => stats.agg.tgt },
    { label: "Receptions", value: (stats) => stats.agg.rec },
    { label: "Rec yards", value: (stats) => stats.agg.cyd },
    { label: "First downs", value: (stats) => stats.agg.fd },
  ],
  TE: [
    { label: "Targets", value: (stats) => stats.agg.tgt },
    { label: "Receptions", value: (stats) => stats.agg.rec },
    { label: "Rec yards", value: (stats) => stats.agg.cyd },
  ],
  K: [
    { label: "FG made", value: (stats) => stats.agg.fgm },
    { label: "FG att", value: (stats) => stats.agg.fga },
    { label: "XP made", value: (stats) => stats.agg.xpm },
  ],
  DEF: [
    { label: "Sacks", value: (stats) => stats.agg.sk },
    { label: "INT", value: (stats) => stats.agg.int },
    {
      label: "Points allowed/g",
      lo: true,
      value: (stats) => stats.agg.pa,
      format: f1,
    },
  ],
  DB: [
    { label: "Tackles", value: (stats) => stats.agg.tkl },
    { label: "INT", value: (stats) => stats.agg.int },
    { label: "Passes defended", value: (stats) => stats.agg.pd },
  ],
  LB: [
    { label: "Tackles", value: (stats) => stats.agg.tkl },
    { label: "Sacks", value: (stats) => stats.agg.sk },
  ],
  DL: [
    { label: "Sacks", value: (stats) => stats.agg.sk },
    { label: "Tackles", value: (stats) => stats.agg.tkl },
  ],
};

/** The modal. Parent owns the tick list; dropping below 2 closes it. */
export function CompareModal({
  model,
  range,
  ids,
  onRemove,
  onOpenPlayer,
  onClearAll,
  onClose,
}: {
  model: SeasonModel;
  range: RangeConfig;
  ids: string[];
  onRemove: (id: string) => void;
  onOpenPlayer: (id: string) => void;
  onClearAll: () => void;
  onClose: () => void;
}) {
  const players = ids
    .map((id) => model.playerById.get(id))
    .filter((player): player is NonNullable<typeof player> => player != null);
  // one range-stats computation per player, shared by every row
  const stats = useMemo(
    () =>
      new Map(
        players.map((player) => [
          player.id,
          playerRangeStats(model, player.id, range),
        ]),
      ),
    [players, model, range],
  );
  // position-specific rows only make sense for same-position comparisons
  const samePos = players.every(
    (player) => player.position === players[0]?.position,
  );
  const posRows = samePos ? (POS_ROWS[players[0]?.position ?? ""] ?? []) : [];

  const renderRow = (row: CmpRow): ReactNode => {
    const vals = players.map((player) => {
      const playerStats = stats.get(player.id);
      return playerStats ? row.value(playerStats, model, player.id) : null;
    });
    const present = vals.filter((value): value is number => value != null);
    // best = max (or min for lower-is-better rows); all-equal rows stay unmarked
    const best =
      present.length > 1 && new Set(present).size > 1
        ? row.lo
          ? Math.min(...present)
          : Math.max(...present)
        : null;
    return (
      <tr key={row.label}>
        <td className="l">{row.label}</td>
        {players.map((player, index) => {
          const value = vals[index];
          const isBest = best != null && value === best;
          return (
            <td key={player.id} className={isBest ? styles.lead : undefined}>
              {value == null ? (
                <span className={pstyles.gap}>—</span>
              ) : (
                <>
                  <span className="num">
                    {row.format ? row.format(value) : String(value)}
                  </span>
                  {isBest && <span className={styles.bestmark}>▲ best</span>}
                </>
              )}
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <Modal label="Compare players" onClose={onClose} centered>
      <div className={styles.head}>
        <b>Compare</b>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Close compare"
        >
          ×
        </button>
      </div>
      <div className={styles.body}>
        <table className={styles.cmptable}>
          <thead>
            <tr>
              <th className="l" />
              {players.map((player) => (
                <th key={player.id}>
                  <span className={styles.cmpchip}>
                    <Avatar name={player.name} id={player.id} size={30} />
                    <span className={styles.ci}>
                      <button
                        type="button"
                        className={styles.cn}
                        onClick={() => {
                          onOpenPlayer(player.id);
                        }}
                      >
                        {player.name}
                      </button>
                      <span className={styles.cs}>
                        <PosTag pos={player.position} small />{" "}
                        {player.team ?? "FA"}
                      </span>
                    </span>
                    <button
                      type="button"
                      className={styles.cmprm}
                      aria-label={`Remove ${player.name} from compare`}
                      onClick={() => {
                        onRemove(player.id);
                      }}
                    >
                      ×
                    </button>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* sparkline row first: shape before numbers */}
            <tr className={styles.cmpspark}>
              <td className="l dim">Weekly trend</td>
              {players.map((player) => (
                <td key={player.id}>
                  <Spark
                    model={model}
                    playerId={player.id}
                    name={player.name}
                  />
                </td>
              ))}
            </tr>
            {SHARED.map(renderRow)}
            {posRows.length > 0 && (
              <tr className={styles.cmpsec}>
                <td className="l" colSpan={players.length + 1}>
                  {players[0]?.position} stats
                </td>
              </tr>
            )}
            {posRows.map(renderRow)}
            {!samePos && (
              <tr className={styles.cmpsec}>
                <td className="l" colSpan={players.length + 1}>
                  Position-specific rows are hidden for mixed-position
                  comparisons.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className={styles.foot}>
          <span className="dim">
            Follows the list&apos;playerStats scoring and range. Lower is better
            for volatility, position rank and points allowed.
          </span>
          <button
            type="button"
            className={pstyles.linkbtn}
            onClick={onClearAll}
          >
            Clear all
          </button>
        </div>
      </div>
    </Modal>
  );
}
