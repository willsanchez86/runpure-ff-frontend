/** Pure helpers for the NFL screen (NFL spec §3–§5): phase/week defaults,
 * per-slate game selection, byes and display formatting. No React. */
import type { Game } from "@/lib/api/contract";
import type { TeamInfo } from "@/lib/scoring/types";

/** A season phase as the contract carries it. */
export type Phase = "PRE" | "REG" | "POST";

/** The slate on screen: one phase + one week. */
export interface Slate {
  phase: Phase;
  week: number;
}

/** The distinct weeks a phase actually has, ascending. */
export function phaseWeeks(games: Game[], phase: Phase): number[] {
  const weeks = new Set<number>();
  for (const game of games) {
    if (game.phase === phase) weeks.add(game.week);
  }
  return [...weeks].sort((left, right) => left - right);
}

/** First week of the phase with a game not yet final; null when all played. */
function firstUnplayedWeek(games: Game[], phase: Phase): number | null {
  let week: number | null = null;
  for (const game of games) {
    if (game.phase !== phase || game.final) continue;
    if (week === null || game.week < week) week = game.week;
  }
  return week;
}

/** NS1 default view: regular season, current week — the next upcoming week
 * once the regular season ends, the postseason once it starts. */
export function defaultSlate(games: Game[]): Slate {
  const regularCurrent = firstUnplayedWeek(games, "REG");
  if (regularCurrent !== null) return { phase: "REG", week: regularCurrent };

  // regular season fully played: postseason if it exists, else the last week
  const postWeeks = phaseWeeks(games, "POST");
  if (postWeeks.length > 0) {
    const postCurrent = firstUnplayedWeek(games, "POST");
    return { phase: "POST", week: postCurrent ?? postWeeks.at(-1) ?? 1 };
  }
  const regWeeks = phaseWeeks(games, "REG");
  return { phase: "REG", week: regWeeks.at(-1) ?? 1 };
}

/** The week a phase opens on when picked by hand: its first unplayed week,
 * or its last week once fully played (first week for an empty phase). */
export function phaseDefaultWeek(games: Game[], phase: Phase): number {
  const unplayed = firstUnplayedWeek(games, phase);
  if (unplayed !== null) return unplayed;
  return phaseWeeks(games, phase).at(-1) ?? 1;
}

/** The slate's games, ordered by kickoff then id for a stable grid. */
export function gamesFor(games: Game[], slate: Slate): Game[] {
  return games
    .filter((game) => game.phase === slate.phase && game.week === slate.week)
    .sort((left, right) =>
      left.kickoff === right.kickoff
        ? left.id.localeCompare(right.id)
        : left.kickoff.localeCompare(right.kickoff),
    );
}

/** Teams on bye in a regular-season week (NS3: derived from byeWeek),
 * sorted by abbreviation. Byes only exist in the regular season. */
export function byeTeams(teams: Iterable<TeamInfo>, slate: Slate): TeamInfo[] {
  if (slate.phase !== "REG") return [];
  return [...teams]
    .filter((team) => team.byeWeek === slate.week)
    .sort((left, right) => left.abbr.localeCompare(right.abbr));
}

const EASTERN_DAY = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  month: "short",
  day: "numeric",
});
const EASTERN_TIME = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  minute: "2-digit",
});

/** Kickoff split for display, in Eastern time: day ("Sun Nov 15") and
 * time ("1:00 PM"). Invalid instants render as gaps. */
export function kickoffParts(iso: string): { day: string; time: string } {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return { day: "—", time: "—" };
  return {
    day: EASTERN_DAY.format(instant),
    time: EASTERN_TIME.format(instant),
  };
}

/** The pregame line as text, e.g. "KC −3.5"; null when the feed has none. */
export function favoriteText(game: Game): string | null {
  if (game.favorite === null || game.spreadLine === null) return null;
  return `${game.favorite} −${String(game.spreadLine)}`;
}

/** Gap rendering (PRD must-have): missing values are "—", never zeros. */
export function gap(value: string | number | null, suffix = ""): string {
  if (value === null || value === "") return "—";
  return `${String(value)}${suffix}`;
}
