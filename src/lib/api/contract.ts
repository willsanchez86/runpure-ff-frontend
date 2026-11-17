/** Contract shapes the screens consume (player spec §9, NFL spec §6; PE4:
 * per-position stat-line types). Hand-authored until the backend commits the
 * real SDL at contract cut-over (foundation spec §13 step 7) — the committed
 * schema.graphql then wins and these types are regenerated from it. */

/** Every position the app knows (player spec §4.2 families). */
export type Position =
  "QB" | "RB" | "WR" | "TE" | "K" | "DEF" | "DB" | "LB" | "DL";

/** Individual-defense positions share the IDP column set and scoring. */
export const IDP_POSITIONS: readonly Position[] = ["DB", "LB", "DL"];

/** One NFL player's bio and current status (player spec §9.1). */
export interface Player {
  id: string;
  name: string;
  position: Position;
  team: string | null;
  jerseyNumber: number | null;
  age: number | null;
  heightIn: number | null;
  weightLb: number | null;
  college: string | null;
  rookieYear: number | null;
  yearsExp: number | null;
  draftYear: number | null;
  draftRound: number | null;
  draftPick: number | null;
  /** Latest injury report: "Q" | "O" | "IR" | null. */
  injuryStatus: string | null;
  practiceStatus: string | null;
}

/** One NFL team with venue and the season's bye (player spec §9.1). */
export interface Team {
  abbr: string;
  city: string;
  nickname: string;
  name: string;
  conference: string;
  division: string;
  stadium: string;
  roof: "dome" | "open" | "retractable";
  surface: "grass" | "turf";
  headCoach: string;
  byeWeek: number;
}

/** Shared identity on every weekly line (player spec §9.2 interface). */
export interface StatLineBase {
  playerId: string;
  week: number;
  /** The team the player played for THAT week (traded players render right). */
  teamPlayedFor: string;
  opponent: string | null;
  home: boolean;
  snapPct: number | null;
}

/** Quarterback week (player spec §9.2). */
export interface QbStatLine extends StatLineBase {
  position: "QB";
  attempts: number;
  completions: number;
  passYards: number;
  passTds: number;
  interceptions: number;
  sacksTaken: number;
  sackYards: number;
  carries: number;
  rushYards: number;
  rushTds: number;
  fumbles: number;
  fumblesLost: number;
  firstDowns: number;
}

/** Running-back week. */
export interface RbStatLine extends StatLineBase {
  position: "RB";
  carries: number;
  rushYards: number;
  rushTds: number;
  targets: number;
  receptions: number;
  recYards: number;
  recTds: number;
  fumbles: number;
  fumblesLost: number;
  firstDowns: number;
  targetShare: number | null;
  airYardsShare: number | null;
  wopr: number | null;
}

/** Wide-receiver / tight-end week. */
export interface WrTeStatLine extends StatLineBase {
  position: "WR" | "TE";
  targets: number;
  receptions: number;
  recYards: number;
  recTds: number;
  carries: number;
  rushYards: number;
  fumbles: number;
  fumblesLost: number;
  firstDowns: number;
  targetShare: number | null;
  airYardsShare: number | null;
  wopr: number | null;
}

/** Kicker week. */
export interface KStatLine extends StatLineBase {
  position: "K";
  fgMade: number;
  fgMissed: number;
  fg50Plus: number;
  xpMade: number;
}

/** Team-defense week. */
export interface DefStatLine extends StatLineBase {
  position: "DEF";
  pointsAllowed: number;
  yardsAllowed: number;
  sacks: number;
  interceptions: number;
  fumbleRecoveries: number;
  tds: number;
  safeties: number;
}

/** Individual-defender week (DB / LB / DL). */
export interface IdpStatLine extends StatLineBase {
  position: "DB" | "LB" | "DL";
  soloTackles: number;
  assistTackles: number;
  sacks: number;
  tacklesForLoss: number;
  interceptions: number;
  passesDefended: number;
  forcedFumbles: number;
  fumbleRecoveries: number;
  qbHits: number;
  tds: number;
}

/** The PE4 union: one paged query, per-position concrete types. */
export type StatLine =
  | QbStatLine
  | RbStatLine
  | WrTeStatLine
  | KStatLine
  | DefStatLine
  | IdpStatLine;

/** One game of a season, all phases (NFL spec §6). */
export interface Game {
  id: string;
  season: number;
  phase: "PRE" | "REG" | "POST";
  week: number;
  /** ISO instant; rendered in Eastern time. */
  kickoff: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  overtime: boolean;
  final: boolean;
  stadium: string | null;
  roof: string | null;
  surface: string | null;
  temperatureF: number | null;
  windMph: number | null;
  spreadLine: number | null;
  totalLine: number | null;
  favorite: string | null;
  homeQb: string | null;
  awayQb: string | null;
  homeCoach: string | null;
  awayCoach: string | null;
  homeRestDays: number | null;
  awayRestDays: number | null;
  divisionGame: boolean;
}

/** When each dataset last loaded (foundation spec §7); drives freshness UI. */
export interface Freshness {
  playersLoadedAt: string | null;
  statsLoadedAt: string | null;
  gamesLoadedAt: string | null;
}

/** The signed-in app account (existing `me` field). */
export interface Me {
  id: string;
  isOperator: boolean;
}

/** Everything one season's screens need, fetched once and cached per season. */
export interface SeasonData {
  season: number;
  players: Player[];
  teams: Team[];
  statLines: StatLine[];
  games: Game[];
}

/** The seam between screens and transport (foundation spec §6.4, decision F2):
 * apiSource speaks GraphQL at cut-over; sampleSource is the prototype port. */
export interface DataSource {
  me: () => Promise<Me | null>;
  seasonData: (season: number) => Promise<SeasonData>;
  freshness: () => Promise<Freshness>;
}
