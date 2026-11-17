/** Card sections beyond the game log (player spec §6.2): Overview, Splits,
 * Trends, History. All numbers come from the engine; prior seasons load on
 * demand (PE2) and follow the scoring switch. */
"use client";

import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import type { StatLine } from "@/lib/api/contract";
import { dataSource, CURRENT_SEASON, SEASONS } from "@/lib/api/sources";
import {
  buildSeasonModel,
  playerRangeStats,
  stats as st,
} from "@/lib/scoring/engine";
import type { RangeConfig, SeasonModel } from "@/lib/scoring/types";
import { useSettings } from "@/lib/settings/SettingsProvider";
import { f1, Gap } from "@/features/players/cells";
import pstyles from "@/features/players/players.module.css";
import { useSeasonModel } from "@/features/players/usePlayersModel";
import styles from "./card.module.css";

// "start-worthy" weekly points per position: the consistency strip's threshold
const START_THRESH: Record<string, number> = {
  QB: 18,
  RB: 12,
  WR: 12,
  TE: 9,
  K: 7,
  DEF: 6,
  DB: 8,
  DL: 8,
  LB: 8,
};

/** Every loaded season's model (PE2: fetched on demand, cached per season). */
function useAllSeasonModels(): (SeasonModel | null)[] {
  const { settings } = useSettings();
  const queries = useQueries({
    queries: SEASONS.map((season) => ({
      queryKey: ["season", season],
      queryFn: () => dataSource.seasonData(season),
      staleTime: Infinity,
    })),
  });
  // cheap identity key: rebuild models only when a season's data arrives
  const key = queries
    .map((seasonQuery) => (seasonQuery.data ? seasonQuery.data.season : "x"))
    .join(",");
  return useMemo(
    () =>
      queries.map((seasonQuery) =>
        seasonQuery.data
          ? buildSeasonModel(
              seasonQuery.data,
              {
                fmt: settings.fmt,
                tePrem: settings.tePrem,
                ptd6: settings.ptd6,
              },
              CURRENT_SEASON,
            )
          : null,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key tracks data identity
    [key, settings.fmt, settings.tePrem, settings.ptd6],
  );
}

/* ------------------------------------------------------------- Overview */

/** Summary tiles + weekly trend + consistency strip over the active range. */
export function Overview({
  model,
  playerId,
  range,
}: {
  model: SeasonModel;
  playerId: string;
  range: RangeConfig;
}) {
  const stats = playerRangeStats(model, playerId, range);
  const player = model.playerById.get(playerId);
  if (!player) return null;
  // a player with no games in range gets the empty state, not zeros
  if (!stats.gp) {
    return (
      <div className={styles.inlineEmpty}>
        <b>No games yet</b>
        Byes and missed weeks are gaps, never zeros.
      </div>
    );
  }
  const usage: [string, string | null][] = [
    [
      "Snap %",
      stats.snap == null ? null : `${String(Math.round(stats.snap))}%`,
    ],
    ["Target %", stats.tgt == null ? null : `${stats.tgt.toFixed(1)}%`],
    [
      "Tgt share",
      stats.agg.tgtsh == null ? null : `${(stats.agg.tgtsh * 100).toFixed(1)}%`,
    ],
    [
      "Air-yards %",
      stats.agg.aysh == null ? null : `${(stats.agg.aysh * 100).toFixed(1)}%`,
    ],
    ["WOPR", stats.agg.wopr == null ? null : stats.agg.wopr.toFixed(2)],
  ];
  return (
    <div>
      <div className={styles.summary}>
        <Tile value={f1(stats.total)} label="Total pts" />
        <Tile
          value={stats.avg != null ? f1(stats.avg) : "—"}
          small={`· ${String(stats.gp)} GP`}
          label="Points per game"
        />
        <Tile value={stats.high != null ? f1(stats.high) : "—"} label="High" />
        <Tile value={stats.low != null ? f1(stats.low) : "—"} label="Low" />
        <Tile
          value={stats.sd != null ? f1(stats.sd) : "—"}
          label="Volatility (3+ GP)"
        />
      </div>
      {/* usage tiles render only for positions that have usage data */}
      {usage.some(([, value]) => value != null) && (
        <div className={styles.summary}>
          {usage.map(([label, value]) =>
            value == null ? null : (
              <Tile key={label} value={value} label={label} />
            ),
          )}
        </div>
      )}
      <div className={styles.sec}>
        <div className={styles.sech}>
          <h3>Weekly points</h3>
          <span className={styles.hint}>gaps are byes / missed weeks</span>
        </div>
        <TrendChart model={model} playerId={playerId} />
      </div>
      <div className={styles.sec}>
        <div className={styles.sech}>
          <h3>Consistency</h3>
          <span className={styles.hint}>
            floor · median · ceiling vs the start threshold
          </span>
        </div>
        <ConsistencyStrip
          model={model}
          playerId={playerId}
          pos={player.position}
        />
      </div>
    </div>
  );
}

function Tile({
  value,
  label,
  small,
}: {
  value: string;
  label: string;
  small?: string;
}) {
  return (
    <div className={styles.cell}>
      <div className={styles.cv}>
        {value}
        {small && <small> {small}</small>}
      </div>
      <div className={styles.ck}>{label}</div>
    </div>
  );
}

/** Weekly points line; gaps break the line (design language). */
function TrendChart({
  model,
  playerId,
}: {
  model: SeasonModel;
  playerId: string;
}) {
  const width = 760;
  const height = 150;
  const ml = 30;
  const mb = 20;
  const weeks = model.weeks.get(playerId);
  const pts: { week: number; value: number }[] = [];
  for (let week = 1; week <= model.playedWeeks; week++) {
    const entry = weeks?.get(week);
    if (entry?.kind === "played") pts.push({ week, value: entry.pts });
  }
  if (!pts.length)
    return (
      <div className={styles.inlineEmpty}>
        <b>No games yet</b>
      </div>
    );
  const max = Math.max(10, ...pts.map((point) => point.value)) * 1.1;
  const xAt = (week: number) =>
    ml + ((week - 1) * (width - ml - 8)) / Math.max(1, model.playedWeeks - 1);
  const yAt = (value: number) =>
    8 + (1 - Math.max(0, value) / max) * (height - 8 - mb);
  let pathD = "";
  let pen = false;
  for (let week = 1; week <= model.playedWeeks; week++) {
    const entry = weeks?.get(week);
    if (entry?.kind === "played") {
      pathD += `${pen ? "L" : "M"}${xAt(week).toFixed(1)} ${yAt(entry.pts).toFixed(1)}`;
      pen = true;
    } else pen = false;
  }
  return (
    <svg
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      style={{ width: "100%", height: "auto" }}
      role="img"
      aria-label="Weekly fantasy points; byes and missed weeks break the line"
    >
      <line
        x1={ml}
        x2={width - 8}
        y1={height - mb}
        y2={height - mb}
        stroke="var(--line-2)"
      />
      <text
        x={ml - 5}
        y={yAt(max) + 8}
        textAnchor="end"
        fontSize={9}
        fill="var(--muted)"
      >
        {Math.round(max)}
      </text>
      <text
        x={ml - 5}
        y={yAt(0)}
        textAnchor="end"
        fontSize={9}
        fill="var(--muted)"
      >
        0
      </text>
      <path
        d={pathD}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {pts.map((point) => (
        <circle
          key={point.week}
          cx={xAt(point.week)}
          cy={yAt(point.value)}
          r={2.6}
          fill="var(--accent-2)"
        >
          <title>{`Wk ${String(point.week)} · ${f1(point.value)} pts`}</title>
        </circle>
      ))}
    </svg>
  );
}

/** Floor–median–ceiling dot strip with the start-worthy threshold. */
function ConsistencyStrip({
  model,
  playerId,
  pos,
}: {
  model: SeasonModel;
  playerId: string;
  pos: string;
}) {
  const weeks = model.weeks.get(playerId);
  const vals: { week: number; value: number }[] = [];
  weeks?.forEach((entry, week) => {
    if (entry.kind === "played") vals.push({ week, value: entry.pts });
  });
  if (!vals.length)
    return (
      <div className={styles.inlineEmpty}>
        <b>No games yet</b>
      </div>
    );
  const nums = vals
    .map((sample) => sample.value)
    .sort((valueA, valueB) => valueA - valueB);
  const floor = nums[0] ?? 0;
  const ceil = nums[nums.length - 1] ?? 0;
  const med = nums[Math.floor(nums.length / 2)] ?? 0;
  const thr = START_THRESH[pos] ?? 10;
  const above = nums.filter((value) => value >= thr).length;
  const pct = Math.round((above / nums.length) * 100);
  const width = 760;
  const height = 92;
  const ml = 8;
  const mb = 24;
  const max = Math.max(ceil, thr) * 1.12 || 10;
  const xAt = (value: number) =>
    ml + (Math.max(0, value) / max) * (width - ml - 8);
  const marker = (value: number, lab: string, color: string) => (
    <g key={lab}>
      <line
        x1={xAt(value)}
        x2={xAt(value)}
        y1={8}
        y2={height - mb}
        stroke={color}
        strokeWidth={1.5}
      />
      <text
        x={xAt(value)}
        y={height - 8}
        textAnchor="middle"
        fontSize={10}
        fill="var(--muted)"
      >
        {lab} {f1(value)}
      </text>
    </g>
  );
  return (
    <div>
      <svg
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        style={{ width: "100%", height: "auto" }}
        role="img"
        aria-label={`Weekly points distribution: floor ${f1(floor)}, median ${f1(med)}, ceiling ${f1(ceil)}; ${String(pct)} percent of games at or above the ${String(thr)}-point start threshold`}
      >
        <line
          x1={ml}
          x2={width - 8}
          y1={height - mb}
          y2={height - mb}
          stroke="var(--line-2)"
        />
        <line
          x1={xAt(thr)}
          x2={xAt(thr)}
          y1={4}
          y2={height - mb}
          stroke="var(--accent-2)"
          strokeDasharray="3 3"
        />
        {vals.map((sample, index) => (
          <circle
            key={sample.week}
            cx={xAt(sample.value)}
            // vertical jitter keeps equal-valued dots from stacking invisibly
            cy={14 + ((index * 13) % (height - mb - 20))}
            r={4}
            fill="var(--accent)"
            fillOpacity={0.82}
          >
            <title>{`Week ${String(sample.week)} · ${f1(sample.value)} pts`}</title>
          </circle>
        ))}
        {marker(floor, "Floor", "var(--serious)")}
        {marker(med, "Median", "var(--text-2)")}
        {marker(ceil, "Ceiling", "var(--good)")}
      </svg>
      <div className={styles.cfacts}>
        <span>
          <b className="num">{pct}%</b> of games ≥ {thr} pts (start-worthy)
        </span>
        <span className="dim">
          floor {f1(floor)} · median {f1(med)} · ceiling {f1(ceil)} ·{" "}
          {nums.length} games
        </span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Splits */

/** PPG bar rows across all loaded seasons (prototype splitsBlock). */
export function Splits({ playerId }: { playerId: string }) {
  const models = useAllSeasonModels();
  const lines = useMemo(() => {
    const out: { line: StatLine; pts: number; model: SeasonModel }[] = [];
    for (const model of models) {
      if (!model) continue;
      const wm = model.weeks.get(playerId);
      wm?.forEach((entry) => {
        if (entry.kind === "played")
          out.push({ line: entry.line, pts: entry.pts, model: model });
      });
    }
    return out;
  }, [models, playerId]);

  if (!lines.length) {
    return (
      <div className={styles.inlineEmpty}>
        <b>No games yet</b>
      </div>
    );
  }

  // venue facts (roof/surface) come from the home team's stadium
  const roofOf = (game: (typeof lines)[number]) =>
    game.model.teamsByAbbr.get(
      game.line.home ? game.line.teamPlayedFor : (game.line.opponent ?? ""),
    )?.roof;
  const surfaceOf = (game: (typeof lines)[number]) =>
    game.model.teamsByAbbr.get(
      game.line.home ? game.line.teamPlayedFor : (game.line.opponent ?? ""),
    )?.surface;
  const diffOf = (game: (typeof lines)[number]) => {
    const pos = game.model.playerById.get(playerId)?.position ?? "";
    const rank = game.line.opponent
      ? (game.model.fpaRank.get(game.line.opponent)?.get(pos) ?? 16)
      : 16;
    return rank <= 8 ? "Tough" : rank >= 25 ? "Easy" : "Even";
  };
  const divOf = (game: (typeof lines)[number]) => {
    const own = game.model.teamsByAbbr.get(game.line.teamPlayedFor)?.division;
    const opp = game.line.opponent
      ? game.model.teamsByAbbr.get(game.line.opponent)?.division
      : null;
    return own != null && own === opp;
  };

  const cats: [
    string,
    [string, (game: (typeof lines)[number]) => boolean][],
  ][] = [
    [
      "Home / Away",
      [
        ["Home", (game) => game.line.home],
        ["Away", (game) => !game.line.home],
      ],
    ],
    [
      "Roof",
      [
        ["Indoor", (game) => roofOf(game) === "dome"],
        ["Outdoor", (game) => roofOf(game) !== "dome"],
      ],
    ],
    [
      "Surface",
      [
        ["Grass", (game) => surfaceOf(game) === "grass"],
        ["Turf", (game) => surfaceOf(game) === "turf"],
      ],
    ],
    [
      "Matchup",
      [
        ["Tough", (game) => diffOf(game) === "Tough"],
        ["Even", (game) => diffOf(game) === "Even"],
        ["Easy", (game) => diffOf(game) === "Easy"],
      ],
    ],
    [
      "Division",
      [
        ["Division", (game) => divOf(game)],
        ["Non-division", (game) => !divOf(game)],
      ],
    ],
  ];

  // bars scale against the best split so differences stay readable
  const maxAvg = Math.max(
    1,
    ...cats.flatMap(([, rows]) =>
      rows.map(([, passes]) => {
        const xs = lines.filter(passes).map((game) => game.pts);
        return xs.length ? st.mean(xs) : 0;
      }),
    ),
  );

  return (
    <div className={styles.splitgrid}>
      {cats.map(([cat, defs]) => (
        <div key={cat} className={styles.splitcat}>
          <div className={styles.sct}>{cat}</div>
          {defs.map(([label, passes]) => {
            const xs = lines.filter(passes).map((game) => game.pts);
            const avg = xs.length ? st.mean(xs) : null;
            return (
              <div key={label} className={styles.splitrow}>
                <span className={styles.sl}>{label}</span>
                <span className={styles.strack}>
                  <span
                    className={styles.sfill}
                    style={{
                      width: `${String(avg == null ? 0 : Math.round((avg / maxAvg) * 100))}%`,
                    }}
                  />
                </span>
                <span className={`${styles.sv} num`}>
                  {avg == null ? "—" : f1(avg)}
                </span>
                <span className={styles.sg}>{xs.length}g</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- Trends */

/** Usage small-multiples with a season selector + positional rank over time. */
export function Trends({ playerId }: { playerId: string }) {
  const [season, setSeason] = useState<number>(CURRENT_SEASON);
  const { model } = useSeasonModel(season);
  if (!model) return <div className={styles.inlineEmpty}>Loading…</div>;
  const player = model.playerById.get(playerId);
  const weeks = model.weeks.get(playerId);
  if (!player || !weeks) {
    return (
      <div className={styles.inlineEmpty}>
        <b>Not in the league that season</b>
      </div>
    );
  }

  const metrics: [string, (line: StatLine) => number | null, string][] = [
    ["Snap %", (line) => line.snapPct, "%"],
    [
      "Target share",
      (line) =>
        "targetShare" in line && line.targetShare != null
          ? line.targetShare * 100
          : null,
      "%",
    ],
    [
      "Air-yards share",
      (line) =>
        "airYardsShare" in line && line.airYardsShare != null
          ? line.airYardsShare * 100
          : null,
      "%",
    ],
    ["WOPR", (line) => ("wopr" in line ? line.wopr : null), ""],
  ];
  const avail = metrics.filter(([, get]) =>
    [...weeks.values()].some(
      (entry) => entry.kind === "played" && get(entry.line) != null,
    ),
  );

  // positional rank over time: cumulative points rank per week
  const posPlayers = model.players.filter(
    (posPlayer) => posPlayer.position === player.position,
  );
  const rankSeries: { week: number; rank: number }[] = [];
  for (let week = 1; week <= model.playedWeeks; week++) {
    const totals = posPlayers.map((posPlayer) => {
      let total = 0;
      const wm = model.weeks.get(posPlayer.id);
      for (let point = 1; point <= week; point++) {
        const entry = wm?.get(point);
        if (entry?.kind === "played") total += entry.pts;
      }
      return { id: posPlayer.id, total };
    });
    totals.sort((totalA, totalB) => totalB.total - totalA.total);
    const idx = totals.findIndex((total) => total.id === playerId);
    if (idx >= 0) rankSeries.push({ week, rank: idx + 1 });
  }

  return (
    <div>
      <div className={styles.pills} role="group" aria-label="Trends season">
        {[...SEASONS].reverse().map((year) => (
          <button
            key={year}
            type="button"
            className={`${pstyles.pill} ${year === season ? pstyles.pillOn : ""}`}
            aria-pressed={year === season}
            onClick={() => {
              setSeason(year);
            }}
          >
            {year}
          </button>
        ))}
      </div>
      <div style={{ height: 10 }} />
      {avail.length ? (
        <div className={styles.usagegrid}>
          {avail.map(([label, get, unit]) => (
            <UsagePanel
              key={label}
              label={label}
              unit={unit}
              get={get}
              model={model}
              playerId={playerId}
            />
          ))}
        </div>
      ) : (
        <div className={styles.inlineEmpty}>
          <b>No usage data for this position</b>
          Snap, target and air-yards usage are tracked for skill-position
          players.
        </div>
      )}
      <div className={styles.sec}>
        <div className={styles.sech}>
          <h3>Position rank over time</h3>
          <span className={styles.hint}>
            cumulative {player.position} rank by total points · lower is better
            · of {posPlayers.length}
          </span>
        </div>
        <RankChart
          series={rankSeries}
          total={posPlayers.length}
          weeks={model.playedWeeks}
        />
      </div>
    </div>
  );
}

function UsagePanel({
  label,
  unit,
  get,
  model,
  playerId,
}: {
  label: string;
  unit: string;
  get: (line: StatLine) => number | null;
  model: SeasonModel;
  playerId: string;
}) {
  const width = 360;
  const height = 118;
  const ml = 28;
  const mb = 18;
  const weeks = model.weeks.get(playerId);
  const pts: { week: number; value: number }[] = [];
  weeks?.forEach((entry, week) => {
    if (entry.kind === "played") {
      const value = get(entry.line);
      if (value != null) pts.push({ week, value });
    }
  });
  const max =
    Math.max(...pts.map((point) => point.value), unit === "%" ? 100 : 1) * 1.05;
  const xAt = (week: number) =>
    ml + ((week - 1) * (width - ml - 10)) / Math.max(1, model.seasonWeeks - 1);
  const yAt = (value: number) => 12 + (1 - value / max) * (height - 12 - mb);
  let pathD = "";
  let pen = false;
  for (let week = 1; week <= model.seasonWeeks; week++) {
    const point = pts.find((point) => point.week === week);
    if (point) {
      pathD += `${pen ? "L" : "M"}${xAt(week).toFixed(1)} ${yAt(point.value).toFixed(1)}`;
      pen = true;
    } else pen = false;
  }
  const fmt = (value: number) =>
    unit === "%" ? `${String(Math.round(value))}%` : value.toFixed(2);
  return (
    <figure className={styles.usagepanel}>
      <figcaption>{label}</figcaption>
      <svg
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        style={{ width: "100%", height: "auto" }}
        role="img"
        aria-label={`${label} by week`}
      >
        <line
          x1={ml}
          x2={width - 10}
          y1={height - mb}
          y2={height - mb}
          stroke="var(--line)"
        />
        <text
          x={ml - 5}
          y={yAt(max) + 7}
          textAnchor="end"
          fontSize={9}
          fill="var(--muted)"
        >
          {fmt(max)}
        </text>
        <text
          x={ml - 5}
          y={yAt(0)}
          textAnchor="end"
          fontSize={9}
          fill="var(--muted)"
        >
          0
        </text>
        <path
          d={pathD}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.75}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {pts.map((point) => (
          <circle
            key={point.week}
            cx={xAt(point.week)}
            cy={yAt(point.value)}
            r={2.4}
            fill="var(--accent-2)"
          >
            <title>{`Wk ${String(point.week)} · ${label} ${fmt(point.value)}`}</title>
          </circle>
        ))}
      </svg>
    </figure>
  );
}

function RankChart({
  series,
  total,
  weeks,
}: {
  series: { week: number; rank: number }[];
  total: number;
  weeks: number;
}) {
  if (!series.length)
    return (
      <div className={styles.inlineEmpty}>
        <b>No games yet</b>
      </div>
    );
  const width = 760;
  const height = 140;
  const ml = 30;
  const mb = 18;
  const xAt = (week: number) =>
    ml + ((week - 1) * (width - ml - 8)) / Math.max(1, weeks - 1);
  const yAt = (rank: number) =>
    10 + ((rank - 1) / Math.max(1, total - 1)) * (height - 10 - mb);
  const pathD = series
    .map(
      (point, idx) =>
        `${idx ? "L" : "M"}${xAt(point.week).toFixed(1)} ${yAt(point.rank).toFixed(1)}`,
    )
    .join("");
  return (
    <svg
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      style={{ width: "100%", height: "auto" }}
      role="img"
      aria-label="Positional rank by week; lower is better"
    >
      <line
        x1={ml}
        x2={width - 8}
        y1={height - mb}
        y2={height - mb}
        stroke="var(--line-2)"
      />
      <text
        x={ml - 5}
        y={yAt(1) + 4}
        textAnchor="end"
        fontSize={9}
        fill="var(--muted)"
      >
        1
      </text>
      <text
        x={ml - 5}
        y={yAt(total)}
        textAnchor="end"
        fontSize={9}
        fill="var(--muted)"
      >
        {total}
      </text>
      <path
        d={pathD}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {series.map((point) => (
        <circle
          key={point.week}
          cx={xAt(point.week)}
          cy={yAt(point.rank)}
          r={2.4}
          fill="var(--accent-2)"
        >
          <title>{`Wk ${String(point.week)} · rank ${String(point.rank)}`}</title>
        </circle>
      ))}
    </svg>
  );
}

/* -------------------------------------------------------------- History */

/** Season-by-season career table (PE2: real data, exact ranks). */
export function History({ playerId }: { playerId: string }) {
  const models = useAllSeasonModels();
  const range: RangeConfig = {
    kind: "season",
    from: 1,
    to: 18,
    perGame: false,
  };
  return (
    <div>
      <div className={styles.panelcard}>
        <div className={styles.tw}>
          <table className={styles.career} aria-label="Year over year">
            <thead>
              <tr>
                <th className="l">Season</th>
                <th className="l">Team</th>
                <th>GP</th>
                <th>Total</th>
                <th>PPG</th>
                <th>High</th>
                <th>Low</th>
                <th>Vol</th>
                <th>Pos rank</th>
              </tr>
            </thead>
            <tbody>
              {[...SEASONS].reverse().map((year) => {
                const model = models[SEASONS.indexOf(year)];
                if (!model) {
                  return (
                    <tr key={year}>
                      <td className="l">{year}</td>
                      <td className="l" colSpan={8}>
                        <span className={pstyles.gap}>Loading…</span>
                      </td>
                    </tr>
                  );
                }
                const player = model.playerById.get(playerId);
                if (!player) {
                  return (
                    <tr key={year} className={styles.gaprow}>
                      <td className="l">{year}</td>
                      <td className="l" colSpan={8}>
                        <span className={pstyles.gap}>
                          Not in the league yet
                        </span>
                      </td>
                    </tr>
                  );
                }
                const stats = playerRangeStats(model, playerId, range);
                const rank = model.seasonRank.get(playerId);
                return (
                  <tr key={year}>
                    <td className="l" style={{ fontWeight: 600 }}>
                      {year}{" "}
                      {model.isCurrent && (
                        <span className={styles.partialtag}>partial</span>
                      )}
                    </td>
                    <td className="l">{player.team ?? "—"}</td>
                    <td className="num">{stats.gp}</td>
                    <td className="num">{f1(stats.total)}</td>
                    <td>
                      {stats.avg == null ? (
                        <Gap />
                      ) : (
                        <>
                          <span className="num">{f1(stats.avg)}</span>{" "}
                          <span className="avg-gp">· {stats.gp} GP</span>
                        </>
                      )}
                    </td>
                    <td>
                      {stats.high == null ? (
                        <Gap />
                      ) : (
                        <span className="num">{f1(stats.high)}</span>
                      )}
                    </td>
                    <td>
                      {stats.low == null ? (
                        <Gap />
                      ) : (
                        <span className="num">{f1(stats.low)}</span>
                      )}
                    </td>
                    <td>
                      {stats.sd == null ? (
                        <span className="dim">—</span>
                      ) : (
                        <span className="num">{f1(stats.sd)}</span>
                      )}
                    </td>
                    <td className="num">
                      {rank ? `${player.position}${String(rank)}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className={styles.sec}>
        <div className={styles.panelcard}>
          <div className={styles.stubnote}>
            Transaction history and projections-vs-actual arrive in a later
            phase — designed-for stubs.
          </div>
        </div>
      </div>
    </div>
  );
}
