/** The column catalog (player spec §4.1): every column's header, tooltip
 * (naming its Overview definition), category group, sort accessor, default
 * direction and renderer. Counting-stat columns respect the per-game toggle. */
import type { ReactNode } from "react";
import type { Player } from "@/lib/api/contract";
import { matchup } from "@/lib/scoring/engine";
import type { SeasonModel } from "@/lib/scoring/types";
import type { Settings } from "@/lib/settings/model";
import type { Row } from "./filtering";
import {
  f1,
  Gap,
  MatchChip,
  SnapBar,
  Spark,
  SplitPair,
  TierCell,
} from "./cells";

/** Rendering context every cell receives. */
export interface ColCtx {
  model: SeasonModel;
  settings: Settings;
}

/** One column definition. */
export interface ColDef {
  key: string;
  /** Column header text. */
  lab: string;
  /** Hover tooltip; names the Overview definition behind the number. */
  tip: string;
  /** Category for the group-header row and the columns modal. */
  cat: string;
  /** Left-aligned (non-numeric) column. */
  left?: boolean;
  /** Ascending default sort (opp/bye/rank/tier; player spec §4.3). */
  asc?: boolean;
  get: (row: Row, ctx: ColCtx) => number | null;
  render: (row: Row, ctx: ColCtx) => ReactNode;
}

const num = (
  value: number | null | undefined,
  fmt?: (value: number) => string,
): ReactNode =>
  value == null ? (
    <Gap />
  ) : (
    <span className="num">{fmt ? fmt(value) : String(value)}</span>
  );

/** Counting stat: totals, or per-game to one decimal when toggled. */
// counting stats honour the per-game toggle: totals, or value / games played
const count = (v: number | null, gp: number, s: Settings): ReactNode => {
  if (v == null) return <Gap />;
  if (s.perGame) {
    return <span className="num">{gp ? (v / gp).toFixed(1) : "—"}</span>;
  }
  return (
    <span className="num">
      {Number.isInteger(v) ? String(v) : v.toFixed(0)}
    </span>
  );
};

const seasonRank = (player: Player, ctx: ColCtx): number | null =>
  ctx.model.seasonRank.get(player.id) ?? null;

/** Every column, keyed (prototype COLS, typed). */
export const COLS: Partial<Record<string, ColDef>> = {
  total: {
    key: "total",
    lab: "Total",
    cat: "FANTASY",
    tip: "Total fantasy points in the selected range",
    get: (row) => (row.stats.gp ? row.stats.total : null),
    render: (row) => (row.stats.gp ? num(row.stats.total, f1) : <Gap />),
  },
  avg: {
    key: "avg",
    lab: "PPG",
    cat: "FANTASY",
    tip: "Points per game in range. Divides by games actually played; the games-played count sits beside it.",
    get: (row) => row.stats.avg,
    render: (row) =>
      row.stats.gp && row.stats.avg != null ? (
        <>
          <span className="num">{f1(row.stats.avg)}</span>{" "}
          <span className="avg-gp">· {row.stats.gp} GP</span>
        </>
      ) : (
        <Gap text="no games yet" />
      ),
  },
  high: {
    key: "high",
    lab: "High",
    cat: "FANTASY",
    tip: "Best single game in range",
    get: (row) => row.stats.high,
    render: (row) => num(row.stats.high, f1),
  },
  low: {
    key: "low",
    lab: "Low",
    cat: "FANTASY",
    tip: "Worst single game in range",
    get: (row) => row.stats.low,
    render: (row) => num(row.stats.low, f1),
  },
  sd: {
    key: "sd",
    lab: "Volatility",
    cat: "FANTASY",
    tip: "Standard deviation of weekly points over games played (needs 3+ games). Lower = steadier.",
    get: (row) => row.stats.sd,
    render: (row) =>
      row.stats.sd == null ? (
        <span className="dim" title="Needs at least 3 games played">
          —
        </span>
      ) : (
        num(row.stats.sd, f1)
      ),
  },
  gp: {
    key: "gp",
    lab: "GP",
    cat: "FANTASY",
    tip: "Games actually played in range",
    get: (row) => row.stats.gp,
    render: (row) => num(row.stats.gp),
  },
  rank: {
    key: "rank",
    lab: "Pos rank",
    cat: "FANTASY",
    asc: true,
    tip: "Rank at this position this season by total fantasy points (1 = best). Updates with scoring.",
    get: (row, ctx) => seasonRank(row.player, ctx),
    render: (row, ctx) => {
      const rank = seasonRank(row.player, ctx);
      return rank ? (
        <span className="num">
          {row.player.position}
          {rank}
        </span>
      ) : (
        <Gap />
      );
    },
  },
  tier: {
    key: "tier",
    lab: "Tier",
    cat: "FANTASY",
    asc: true,
    tip: "Positional tier from season rank: T1 elite · T2 strong · T3 startable · T4 bench · T5 deep.",
    get: (row, ctx) => seasonRank(row.player, ctx),
    render: (row, ctx) => (
      <TierCell rank={seasonRank(row.player, ctx)} pos={row.player.position} />
    ),
  },
  opp: {
    key: "opp",
    lab: "Next matchup",
    cat: "MATCHUP",
    left: true,
    asc: true,
    tip: "Next week's opponent and its rank in fantasy points allowed to this position (1st = fewest allowed/Tough, 32nd = most/Easy). 25th+ Easy, 8th- Tough.",
    get: (row, ctx) => {
      if (!ctx.model.isCurrent) return null;
      const nextMatchup = matchup(
        ctx.model,
        row.player.team,
        row.player.position,
        ctx.model.currentWeek,
      );
      return nextMatchup ? nextMatchup.rank : -1;
    },
    render: (row, ctx) => {
      if (!ctx.model.isCurrent) return <Gap />; // prior season: no next game (spec §4.7)
      const nextMatchup = matchup(
        ctx.model,
        row.player.team,
        row.player.position,
        ctx.model.currentWeek,
      );
      if (!nextMatchup) return <span className="dim">Bye</span>;
      return (
        <span className={undefined}>
          <span className="dim">vs</span> {nextMatchup.opponent}{" "}
          <MatchChip matchup={nextMatchup} />
        </span>
      );
    },
  },
  bye: {
    key: "bye",
    lab: "Bye",
    cat: "MATCHUP",
    asc: true,
    tip: "NFL bye week",
    get: (row, ctx) =>
      row.player.team
        ? (ctx.model.teamsByAbbr.get(row.player.team)?.byeWeek ?? null)
        : null,
    render: (row, ctx) =>
      num(
        row.player.team
          ? (ctx.model.teamsByAbbr.get(row.player.team)?.byeWeek ?? null)
          : null,
      ),
  },
  trend: {
    key: "trend",
    lab: "Weekly",
    cat: "FANTASY",
    left: true,
    tip: "Weekly points over the played weeks. Gaps are byes/missed weeks. Sorts by recent trend.",
    get: (row) => row.stats.trend,
    render: (row, ctx) => (
      <Spark
        model={ctx.model}
        playerId={row.player.id}
        name={row.player.name}
      />
    ),
  },
  proj: {
    key: "proj",
    lab: "Proj (est)",
    cat: "FANTASY",
    tip: "PLACEHOLDER estimate only — real next-week projections arrive in a later phase.",
    get: (row, ctx) => ctx.model.projection.get(row.player.id) ?? null,
    render: (row, ctx) => {
      const value = ctx.model.projection.get(row.player.id) ?? null;
      return value == null ? (
        <span className="dim">—</span>
      ) : (
        <>
          <span className="num dim" style={{ opacity: 0.75 }}>
            {f1(value)}
          </span>{" "}
          <span className="avg-gp">est</span>
        </>
      );
    },
  },
  snap: {
    key: "snap",
    lab: "SNP%",
    cat: "USAGE",
    tip: "Average share of team snaps in range",
    get: (row) => row.stats.snap,
    render: (row) =>
      row.stats.snap == null ? <Gap /> : <SnapBar value={row.stats.snap} />,
  },
  tgt: {
    key: "tgt",
    lab: "TGT%",
    cat: "USAGE",
    tip: "Targets ÷ team pass attempts, averaged over range",
    get: (row) => row.stats.tgt,
    render: (row) =>
      row.stats.tgt == null ? (
        <span className="dim">—</span>
      ) : (
        <span className="num">{row.stats.tgt.toFixed(1)}%</span>
      ),
  },
  tgtsh: {
    key: "tgtsh",
    lab: "Tgt share",
    cat: "USAGE",
    tip: "Share of team targets, averaged over range.",
    get: (row) => row.stats.agg.tgtsh,
    render: (row) =>
      num(row.stats.agg.tgtsh, (value) => `${(value * 100).toFixed(1)}%`),
  },
  aysh: {
    key: "aysh",
    lab: "AY%",
    cat: "USAGE",
    tip: "Air-yards share — share of team air yards, averaged over range.",
    get: (row) => row.stats.agg.aysh,
    render: (row) =>
      num(row.stats.agg.aysh, (value) => `${(value * 100).toFixed(1)}%`),
  },
  wopr: {
    key: "wopr",
    lab: "WOPR",
    cat: "USAGE",
    tip: "Weighted Opportunity Rating ≈ 1.5×target share + 0.7×air-yards share (avg over range).",
    get: (row) => row.stats.agg.wopr,
    render: (row) => num(row.stats.agg.wopr, (value) => value.toFixed(2)),
  },
  rec_c: {
    key: "rec_c",
    lab: "Rec",
    cat: "RECEIVING",
    tip: "Receptions (range; per-game when toggled)",
    get: (row) => row.stats.agg.rec,
    render: (row, ctx) => count(row.stats.agg.rec, row.stats.gp, ctx.settings),
  },
  tgt_c: {
    key: "tgt_c",
    lab: "Tgt",
    cat: "RECEIVING",
    tip: "Targets (range; per-game when toggled)",
    get: (row) => row.stats.agg.tgt,
    render: (row, ctx) => count(row.stats.agg.tgt, row.stats.gp, ctx.settings),
  },
  recyd: {
    key: "recyd",
    lab: "Rec yd",
    cat: "RECEIVING",
    tip: "Receiving yards (range; per-game when toggled)",
    get: (row) => row.stats.agg.cyd,
    render: (row, ctx) => count(row.stats.agg.cyd, row.stats.gp, ctx.settings),
  },
  catch: {
    key: "catch",
    lab: "Catch%",
    cat: "RECEIVING",
    tip: "Receptions ÷ targets (range)",
    get: (row) =>
      row.stats.agg.tgt ? row.stats.agg.rec / row.stats.agg.tgt : null,
    render: (row) =>
      row.stats.agg.tgt ? (
        num(
          (row.stats.agg.rec / row.stats.agg.tgt) * 100,
          (value) => `${String(Math.round(value))}%`,
        )
      ) : (
        <Gap />
      ),
  },
  ypt: {
    key: "ypt",
    lab: "Y/Tgt",
    cat: "EFFICIENCY",
    tip: "Receiving yards per target (range)",
    get: (row) =>
      row.stats.agg.tgt ? row.stats.agg.cyd / row.stats.agg.tgt : null,
    render: (row) =>
      row.stats.agg.tgt ? (
        num(row.stats.agg.cyd / row.stats.agg.tgt, f1)
      ) : (
        <Gap />
      ),
  },
  car_c: {
    key: "car_c",
    lab: "Car",
    cat: "RUSHING",
    tip: "Carries (range; per-game when toggled)",
    get: (row) => row.stats.agg.car,
    render: (row, ctx) => count(row.stats.agg.car, row.stats.gp, ctx.settings),
  },
  ryd_c: {
    key: "ryd_c",
    lab: "Rush yd",
    cat: "RUSHING",
    tip: "Rushing yards (range; per-game when toggled)",
    get: (row) => row.stats.agg.ryd,
    render: (row, ctx) => count(row.stats.agg.ryd, row.stats.gp, ctx.settings),
  },
  ypc: {
    key: "ypc",
    lab: "Y/C",
    cat: "EFFICIENCY",
    tip: "Rushing yards per carry (range)",
    get: (row) =>
      row.stats.agg.car ? row.stats.agg.ryd / row.stats.agg.car : null,
    render: (row) =>
      row.stats.agg.car ? (
        num(row.stats.agg.ryd / row.stats.agg.car, f1)
      ) : (
        <Gap />
      ),
  },
  fd: {
    key: "fd",
    lab: "1D",
    cat: "EFFICIENCY",
    tip: "First downs produced (range; per-game when toggled)",
    get: (row) => row.stats.agg.fd,
    render: (row, ctx) => count(row.stats.agg.fd, row.stats.gp, ctx.settings),
  },
  pyd_c: {
    key: "pyd_c",
    lab: "Pass yd",
    cat: "PASSING",
    tip: "Passing yards (range; per-game when toggled)",
    get: (row) => row.stats.agg.pyd,
    render: (row, ctx) => count(row.stats.agg.pyd, row.stats.gp, ctx.settings),
  },
  ptd_c: {
    key: "ptd_c",
    lab: "Pass TD",
    cat: "PASSING",
    tip: "Passing touchdowns (range; per-game when toggled)",
    get: (row) => row.stats.agg.ptd,
    render: (row, ctx) => count(row.stats.agg.ptd, row.stats.gp, ctx.settings),
  },
  k_fgm: {
    key: "k_fgm",
    lab: "FGM",
    cat: "KICKING",
    tip: "Field goals made (range)",
    get: (row) => row.stats.agg.fgm,
    render: (row) => num(row.stats.agg.fgm),
  },
  k_fga: {
    key: "k_fga",
    lab: "FGA",
    cat: "KICKING",
    tip: "Field goals attempted (range)",
    get: (row) => row.stats.agg.fga,
    render: (row) => num(row.stats.agg.fga),
  },
  k_fgpct: {
    key: "k_fgpct",
    lab: "FG%",
    cat: "KICKING",
    tip: "Field-goal percentage (range)",
    get: (row) =>
      row.stats.agg.fga ? row.stats.agg.fgm / row.stats.agg.fga : null,
    render: (row) =>
      row.stats.agg.fga ? (
        num(
          Math.round((100 * row.stats.agg.fgm) / row.stats.agg.fga),
          (value) => `${String(value)}%`,
        )
      ) : (
        <Gap />
      ),
  },
  k_lng50: {
    key: "k_lng50",
    lab: "50+",
    cat: "KICKING",
    tip: "Field goals made from 50+ yards (range)",
    get: (row) => row.stats.agg.lng50,
    render: (row) => num(row.stats.agg.lng50),
  },
  k_xpm: {
    key: "k_xpm",
    lab: "XPM",
    cat: "KICKING",
    tip: "Extra points made (range)",
    get: (row) => row.stats.agg.xpm,
    render: (row) => num(row.stats.agg.xpm),
  },
  d_sk: {
    key: "d_sk",
    lab: "Sacks",
    cat: "DEFENSE",
    tip: "Sacks (range)",
    get: (row) => row.stats.agg.sk,
    render: (row) => num(row.stats.agg.sk),
  },
  d_int: {
    key: "d_int",
    lab: "INT",
    cat: "DEFENSE",
    tip: "Interceptions (range)",
    get: (row) => row.stats.agg.int,
    render: (row) => num(row.stats.agg.int),
  },
  d_fr: {
    key: "d_fr",
    lab: "FR",
    cat: "DEFENSE",
    tip: "Fumble recoveries (range)",
    get: (row) => row.stats.agg.fr,
    render: (row) => num(row.stats.agg.fr),
  },
  d_td: {
    key: "d_td",
    lab: "TD",
    cat: "DEFENSE",
    tip: "Defensive/return touchdowns (range)",
    get: (row) => row.stats.agg.td,
    render: (row) => num(row.stats.agg.td),
  },
  d_pa: {
    key: "d_pa",
    lab: "PA/g",
    cat: "SCORING",
    tip: "Points allowed per game (lower is better)",
    get: (row) => row.stats.agg.pa,
    render: (row) => num(row.stats.agg.pa, f1),
  },
  d_ya: {
    key: "d_ya",
    lab: "Yds/g",
    cat: "SCORING",
    tip: "Yards allowed per game",
    get: (row) => row.stats.agg.ya,
    render: (row) =>
      num(row.stats.agg.ya, (value) => String(Math.round(value))),
  },
  i_tkl: {
    key: "i_tkl",
    lab: "Tkl",
    cat: "TACKLES",
    tip: "Total tackles — solo + assist (range)",
    get: (row) => row.stats.agg.tkl,
    render: (row) => num(row.stats.agg.tkl),
  },
  i_sk: {
    key: "i_sk",
    lab: "Sacks",
    cat: "IMPACT",
    tip: "Sacks (range)",
    get: (row) => row.stats.agg.sk,
    render: (row) => num(row.stats.agg.sk),
  },
  i_int: {
    key: "i_int",
    lab: "INT",
    cat: "IMPACT",
    tip: "Interceptions (range)",
    get: (row) => row.stats.agg.int,
    render: (row) => num(row.stats.agg.int),
  },
  i_pd: {
    key: "i_pd",
    lab: "PD",
    cat: "IMPACT",
    tip: "Passes defended (range)",
    get: (row) => row.stats.agg.pd,
    render: (row) => num(row.stats.agg.pd),
  },
  split_ha: {
    key: "split_ha",
    lab: "Home/Away",
    cat: "SPLITS",
    left: true,
    tip: "PPG at home vs away in range, with games played in each split.",
    get: (row) => row.stats.split.home?.ppg ?? null,
    render: (row) => (
      <SplitPair
        left={row.stats.split.home}
        right={row.stats.split.away}
        leftLabel="Home"
        rightLabel="Away"
      />
    ),
  },
  split_te: {
    key: "split_te",
    lab: "vs Tough/Easy",
    cat: "SPLITS",
    left: true,
    tip: "PPG vs Tough (opponent top-8 vs this position) and vs Easy (25th+) defenses in range.",
    get: (row) => row.stats.split.tough?.ppg ?? null,
    render: (row) => (
      <SplitPair
        left={row.stats.split.tough}
        right={row.stats.split.easy}
        leftLabel="Tough"
        rightLabel="Easy"
      />
    ),
  },
};

/** View presets for the columns modal (skill-position set; player spec §7). */
export const PRESETS: Record<string, string[]> = {
  Fantasy: ["total", "avg", "sd", "rank", "opp", "trend"],
  Receiving: ["avg", "rec_c", "tgt_c", "recyd", "catch", "ypt", "aysh", "opp"],
  Rushing: ["avg", "car_c", "ryd_c", "ypc", "fd", "snap", "opp"],
  Efficiency: ["avg", "ypc", "ypt", "catch", "snap", "opp"],
  Usage: ["avg", "snap", "tgtsh", "aysh", "wopr", "opp"],
};

/** Category display order in the modal (player spec §7). */
export const CAT_ORDER = [
  "FANTASY",
  "PASSING",
  "RUSHING",
  "RECEIVING",
  "USAGE",
  "EFFICIENCY",
  "DEFENSE",
  "SCORING",
  "TACKLES",
  "IMPACT",
  "KICKING",
  "SPLITS",
  "MATCHUP",
];
