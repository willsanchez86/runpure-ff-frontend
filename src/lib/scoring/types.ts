/** Scoring-engine types (foundation spec §11, ADR-0007). Pure data; no React. */
import type { Game, Player, StatLine } from "@/lib/api/contract";

/** The scoring switch (Player explorer PRD): format + two modifiers. */
export interface ScoringConfig {
  fmt: "ppr" | "half" | "std";
  tePrem: boolean;
  ptd6: boolean;
}

/** The range switch: full season or a custom week span; per-game toggle. */
export interface RangeConfig {
  kind: "season" | "custom";
  from: number;
  to: number;
  perGame: boolean;
}

/** One week on a player's season: played, a bye gap, a missed gap, or (current
 * season only) an upcoming week. Gaps are never zeros (design language). */
export type WeekEntry =
  | { kind: "played"; line: StatLine; pts: number }
  | { kind: "bye" }
  | { kind: "missed" }
  | { kind: "upcoming"; opponent: string | null };

/** A team's final result for one week, joined from games. */
export interface WeekResult {
  /** Win / loss / tie, from this team's perspective. */
  wl: "W" | "L" | "T";
  /** This team's score, then the opponent's. */
  us: number;
  them: number;
  /** Decided in overtime. */
  ot: boolean;
}

/** Matchup difficulty (Overview shared term): opponent's FPA rank 1–32. */
export interface Matchup {
  opponent: string;
  rank: number;
  label: "Tough" | "Even" | "Easy";
}

/** Position-specific totals over the active range (prototype pstats.agg). */
export interface RangeAgg {
  // kicking: field goals made/attempted, extra points, makes from 50+ yards
  fgm: number;
  fga: number;
  xpm: number;
  lng50: number;
  // defense: sacks, interceptions, fumble recoveries, touchdowns
  sk: number;
  int: number;
  fr: number;
  td: number;
  // team defense: points / yards allowed per game (null when not a DEF)
  pa: number | null;
  ya: number | null;
  // tackles: solo, assisted, total, passes defended
  solo: number;
  ast: number;
  tkl: number;
  pd: number;
  // rushing & receiving: carries, rush yards, targets, receptions, rec yards,
  // first downs
  car: number;
  ryd: number;
  tgt: number;
  rec: number;
  cyd: number;
  fd: number;
  // passing: attempts, completions, pass yards, pass TDs
  patt: number;
  pcmp: number;
  pyd: number;
  ptd: number;
  // usage averages: air-yards share, WOPR, target share (null = no data)
  aysh: number | null;
  wopr: number | null;
  tgtsh: number | null;
}

/** One split cell: PPG and the games behind it (sample size always shown). */
export interface SplitCell {
  ppg: number;
  games: number;
}

/** Everything the table/card shows for one player over the active range. */
export interface PlayerRangeStats {
  /** Games actually played in range; every average divides by this. */
  gp: number;
  total: number;
  avg: number | null;
  /** Best and worst single games in range. */
  high: number | null;
  low: number | null;
  /** Volatility: sd of weekly points, needs 3+ games (Overview). */
  sd: number | null;
  /** Average share of team snaps in range. */
  snap: number | null;
  /** Targets ÷ team pass attempts, averaged, as a percentage. */
  tgt: number | null;
  /** Last 3 played games' mean minus the mean of everything before them. */
  trend: number;
  agg: RangeAgg;
  split: {
    home: SplitCell | null;
    away: SplitCell | null;
    tough: SplitCell | null;
    easy: SplitCell | null;
  };
}

/** The per-season derived model every surface reads (foundation §11). */
export interface SeasonModel {
  season: number;
  isCurrent: boolean;
  /** Last week with a final game; 0 in a season with none. */
  playedWeeks: number;
  seasonWeeks: number;
  /** playedWeeks + 1 while the season runs, else playedWeeks. */
  currentWeek: number;
  players: Player[];
  playerById: Map<string, Player>;
  teamsByAbbr: Map<string, TeamInfo>;
  /** playerId -> week -> entry. */
  weeks: Map<string, Map<number, WeekEntry>>;
  /** playerId -> positional rank (1 best, by range-independent season total). */
  seasonRank: Map<string, number>;
  /** playerId -> overall rank (IDP ranked within IDP only). */
  overallRank: Map<string, number>;
  /** team -> position -> FPA rank 1 (fewest allowed) .. 32 (most). */
  fpaRank: Map<string, Map<string, number>>;
  /** position -> league-average FPA per game. */
  fpaLeague: Map<string, number>;
  /** playerId -> placeholder projection for the current week, or null. */
  projection: Map<string, number | null>;
  /** team -> week -> result. */
  results: Map<string, Map<number, WeekResult>>;
  /** team -> week -> opponent abbr (null = bye). */
  opponents: Map<string, Map<number, string | null>>;
  games: Game[];
}

/** Team info the model needs beyond the contract Team (alias for clarity). */
export interface TeamInfo {
  abbr: string;
  name: string;
  division: string;
  byeWeek: number;
  roof: string | null;
  surface: string | null;
  stadium: string | null;
}
