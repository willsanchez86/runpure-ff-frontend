/** Game log (player spec §6.2): season pills 2026→2022; WK · RESULT · OPP ·
 * position stat groups · FPTS · SNP%; cells heat-mapped within their column,
 * polarity position-aware; byes/missed are gap rows; upcoming weeks are blank
 * rows with the matchup chip; traded weeks show the team played for. */
"use client";

import { SEASONS } from "@/lib/api/sources";
import { matchup } from "@/lib/scoring/engine";
import type { SeasonModel, WeekEntry } from "@/lib/scoring/types";
import { MatchChip } from "@/features/players/cells";
import pstyles from "@/features/players/players.module.css";
import { useSeasonModel } from "@/features/players/usePlayersModel";
import { BAD_KEYS, logSpec, type LogCol } from "./logSpec";
import styles from "./card.module.css";

/** The tab body: pills + the heat table for the selected season. */
export function GameLog({
  playerId,
  season,
  onSeason,
}: {
  playerId: string;
  season: number;
  onSeason: (year: number) => void;
}) {
  const { model, isLoading } = useSeasonModel(season);
  return (
    <div>
      <div className={styles.pills} role="group" aria-label="Game-log season">
        {[...SEASONS].reverse().map((year) => (
          <button
            key={year}
            type="button"
            className={`${pstyles.pill} ${year === season ? pstyles.pillOn : ""}`}
            aria-pressed={year === season}
            onClick={() => {
              onSeason(year);
            }}
          >
            {year}
          </button>
        ))}
      </div>
      <div style={{ height: 10 }} />
      {isLoading || !model ? (
        <div className={styles.inlineEmpty}>Loading {season}…</div>
      ) : (
        <HeatTable model={model} playerId={playerId} />
      )}
    </div>
  );
}

/** Integer fallback for columns without their own formatter. */
const intFormat = (v: number): string =>
  Number.isInteger(v) ? String(v) : String(Math.round(v));

/** Each column formats its own value (branch-by-data); null stays a gap. */
const fmtCell = (col: LogCol, v: number | null): string =>
  v == null ? "–" : (col.format ?? intFormat)(v);

function HeatTable({
  model,
  playerId,
}: {
  model: SeasonModel;
  playerId: string;
}) {
  const player = model.playerById.get(playerId);
  const weeks = model.weeks.get(playerId);
  const pos = player?.position ?? "WR";
  const spec = logSpec(pos);
  const cols = spec.flatMap(([, cs]) => cs);

  const rows: { week: number; entry: WeekEntry }[] = [];
  if (weeks) {
    for (let week = 1; week <= model.seasonWeeks; week++) {
      const entry = weeks.get(week);
      if (!entry) continue;
      // prior seasons are complete: no upcoming rows
      if (!model.isCurrent && entry.kind === "upcoming") continue;
      rows.push({ week, entry });
    }
  }

  // per-column domains over played rows, for heat shading
  // per-column min/max over played rows scales each cell's shade
  const domains = (() => {
    const byColumn = new Map<string, [number, number]>();
    for (const col of cols) {
      if (col.proj) continue;
      const vals: number[] = [];
      for (const { entry } of rows) {
        if (entry.kind !== "played") continue;
        const value = col.fpts ? entry.pts : col.get(entry.line);
        if (typeof value === "number") vals.push(value);
      }
      if (vals.length)
        byColumn.set(col.k, [Math.min(...vals), Math.max(...vals)]);
    }
    return byColumn;
  })();

  const badSet = BAD_KEYS[pos] ?? new Set<string>();
  const heatBg = (col: LogCol, value: number | null): string | undefined => {
    if (value == null) return undefined;
    const dom = domains.get(col.k);
    if (!dom) return undefined;
    const [mn, mx] = dom;
    const ratio = mx === mn ? 0.4 : (value - mn) / (mx - mn);
    const alpha = (0.05 + 0.42 * ratio).toFixed(3);
    const rgb = badSet.has(col.k) ? "var(--heat-bad)" : "var(--heat-good)";
    return `rgba(${rgb === "var(--heat-bad)" ? "213,81,81" : "47,174,95"},${alpha})`;
  };

  if (!player || !weeks)
    return <div className={styles.inlineEmpty}>No data.</div>;

  return (
    <div className={styles.panelcard}>
      <div className={styles.tw}>
        <table
          className={styles.heatlog}
          aria-label={`${String(model.season)} game log for ${player.name}: result, opponent and per-week stats; played cells shaded by value within each column; upcoming weeks show matchup difficulty with blank stats`}
        >
          <thead>
            <tr className="grouprow">
              <th className="blank l" colSpan={3} />
              {spec.map(([gl, gc], i) => (
                <th
                  key={i}
                  className={gl ? "grp" : "blank"}
                  colSpan={gc.length}
                >
                  {gl || "·"}
                </th>
              ))}
            </tr>
            <tr>
              <th className="l">WK</th>
              <th className="l">RESULT</th>
              <th className="l">OPP</th>
              {cols.map((column) => (
                <th
                  key={column.k}
                  className={
                    column.fpts
                      ? "fpts"
                      : column.proj
                        ? styles.projcell
                        : undefined
                  }
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ week, entry }) => {
              // gap rows: byes and missed weeks never render as zeros
              if (entry.kind === "bye" || entry.kind === "missed") {
                return (
                  <tr key={week} className={styles.gaprow}>
                    <td className="l">Wk {week}</td>
                    <td className="l dim" colSpan={cols.length + 2}>
                      {entry.kind === "bye" ? "Bye week" : "Did not play"}
                    </td>
                  </tr>
                );
              }
              // upcoming rows keep blank stats and show only the matchup chip
              if (entry.kind === "upcoming") {
                const difficulty = entry.opponent
                  ? matchup(model, player.team, pos, week)
                  : null;
                return (
                  <tr
                    key={week}
                    className={styles.uprow}
                    title="Upcoming — no stats yet; chip shows the opponent's matchup difficulty."
                  >
                    <td className={`l ${styles.wk}`}>Wk {week}</td>
                    <td className="l">
                      <span className={pstyles.gap}>—</span>
                    </td>
                    <td className="l">
                      {entry.opponent ? (
                        <>
                          vs {entry.opponent}{" "}
                          {difficulty && <MatchChip matchup={difficulty} />}
                        </>
                      ) : (
                        <span className={pstyles.gap}>BYE</span>
                      )}
                    </td>
                    {cols.map((column) => (
                      <td key={column.k}>
                        <span className={pstyles.gap}>–</span>
                      </td>
                    ))}
                  </tr>
                );
              }
              const line = entry.line;
              const res = model.results.get(line.teamPlayedFor)?.get(week);
              // a traded week tags the team actually played for
              const traded = line.teamPlayedFor !== player.team;
              return (
                <tr key={week}>
                  <td className="l" style={{ fontWeight: 600 }}>
                    Wk {week}
                  </td>
                  <td className="l">
                    {res ? (
                      <>
                        <span
                          className={`${styles.wl} ${res.wl === "W" ? styles.wlW : res.wl === "L" ? styles.wlL : styles.wlT}`}
                        >
                          {res.wl}
                        </span>{" "}
                        <span className="num">
                          {res.us}–{res.them}
                        </span>
                        {res.ot && <span className={styles.otm}> OT</span>}
                      </>
                    ) : (
                      <span className={pstyles.gap}>—</span>
                    )}
                  </td>
                  <td className="l">
                    {traded && (
                      <span
                        className={styles.tradetag}
                        title={`Played for ${line.teamPlayedFor} that week`}
                      >
                        {line.teamPlayedFor}
                      </span>
                    )}{" "}
                    {line.opponent
                      ? `${line.home ? "vs" : "@"} ${line.opponent}`
                      : "BYE"}
                  </td>
                  {cols.map((column) => {
                    if (column.proj) {
                      return (
                        <td
                          key={column.k}
                          className={styles.projcell}
                          title="Projections have no Phase 1 source — designed-for stub."
                        >
                          –
                        </td>
                      );
                    }
                    const value = column.fpts ? entry.pts : column.get(line);
                    return (
                      <td
                        key={column.k}
                        className={column.fpts ? "fpts" : undefined}
                        style={{ background: heatBg(column, value) }}
                      >
                        <span className="num">{fmtCell(column, value)}</span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className={styles.heatnote}>
        RESULT is the team&apos;s final score &amp; W/L that week. Cells are
        shaded by magnitude within each column — green = production, red =
        negative plays (interceptions, fumbles, sacks taken, points allowed).
        The number is always shown, so colour is never the only cue. Upcoming
        weeks keep blank stats and show the opponent&apos;s matchup-difficulty
        dot. <span className="dim">PROJ is alpha designed-for stub.</span>
      </div>
    </div>
  );
}
