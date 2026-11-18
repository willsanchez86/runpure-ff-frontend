/** The derived-stats engine (foundation spec §11): assembles a season's weeks
 * per player and computes everything the screens show — points, ranks, FPA →
 * matchup difficulty, placeholder projection — from raw stat lines. Pure;
 * memoized by callers per (season data, scoring config). */
import type { SeasonData, StatLine } from "@/lib/api/contract";
import { score } from "./score";
import type {
  Matchup,
  PlayerRangeStats,
  RangeAgg,
  RangeConfig,
  ScoringConfig,
  SeasonModel,
  SplitCell,
  WeekEntry,
  WeekResult,
} from "./types";

const sum = (xs: number[]): number => xs.reduce((acc, value) => acc + value, 0);
const mean = (xs: number[]): number => sum(xs) / xs.length;
const sdev = (xs: number[]): number => {
  const avg = mean(xs);
  return Math.sqrt(mean(xs.map((value) => (value - avg) ** 2)));
};

/** Builds the full per-season model (prototype compute(), on contract data). */
export function buildSeasonModel(
  data: SeasonData,
  cfg: ScoringConfig,
  currentSeason: number,
): SeasonModel {
  const isCurrent = data.season === currentSeason;
  const regGames = data.games.filter((game) => game.phase === "REG");
  // season shape comes from the games themselves, not a constant
  const seasonWeeks = Math.max(1, ...regGames.map((game) => game.week));
  const playedWeeks = Math.max(
    0,
    ...regGames.filter((game) => game.final).map((game) => game.week),
  );
  const currentWeek = isCurrent
    ? Math.min(playedWeeks + 1, seasonWeeks)
    : playedWeeks;

  const teamsByAbbr = new Map(
    data.teams.map((team) => [
      team.abbr,
      {
        abbr: team.abbr,
        name: team.name,
        division: team.division,
        byeWeek: team.byeWeek,
        roof: team.roof,
        surface: team.surface,
        stadium: team.stadium,
        logoUrl: team.logoUrl,
        color: team.color,
      },
    ]),
  );

  // games index: opponents + results per team/week
  const opponents = new Map<string, Map<number, string | null>>();
  const results = new Map<string, Map<number, WeekResult>>();
  for (const team of data.teams) {
    opponents.set(team.abbr, new Map());
    results.set(team.abbr, new Map());
  }
  for (const game of regGames) {
    opponents.get(game.homeTeam)?.set(game.week, game.awayTeam);
    opponents.get(game.awayTeam)?.set(game.week, game.homeTeam);
    if (game.final && game.homeScore != null && game.awayScore != null) {
      const entry = (us: number, them: number): WeekResult => ({
        wl: us > them ? "W" : us < them ? "L" : "T",
        us,
        them,
        ot: game.overtime,
      });
      results
        .get(game.homeTeam)
        ?.set(game.week, entry(game.homeScore, game.awayScore));
      results
        .get(game.awayTeam)
        ?.set(game.week, entry(game.awayScore, game.homeScore));
    }
  }
  for (const team of data.teams) {
    for (let week = 1; week <= seasonWeeks; week++) {
      const weekMap = opponents.get(team.abbr);
      if (weekMap && !weekMap.has(week)) weekMap.set(week, null); // bye
    }
  }

  // assemble weeks per player; score played lines
  const linesByPlayer = new Map<string, Map<number, StatLine>>();
  for (const line of data.statLines) {
    const weekMap =
      linesByPlayer.get(line.playerId) ?? new Map<number, StatLine>();
    weekMap.set(line.week, line);
    linesByPlayer.set(line.playerId, weekMap);
  }
  const weeks = new Map<string, Map<number, WeekEntry>>();
  // TGT% denominator, built in the same pass (perf: avoids an O(n^2) rescan)
  const teamPassAttempts = new Map<string, number>();
  for (const line of data.statLines) {
    if (line.position !== "QB") continue;
    const key = `${line.teamPlayedFor}|${String(line.week)}`;
    teamPassAttempts.set(key, (teamPassAttempts.get(key) ?? 0) + line.attempts);
  }
  for (const player of data.players) {
    const weekMap = new Map<number, WeekEntry>();
    const lines = linesByPlayer.get(player.id);
    for (let week = 1; week <= seasonWeeks; week++) {
      const line = lines?.get(week);
      if (line) {
        weekMap.set(week, { kind: "played", line, pts: score(line, cfg) });
        continue;
      }
      const opp = player.team
        ? (opponents.get(player.team)?.get(week) ?? null)
        : null;
      if (week > playedWeeks) {
        weekMap.set(week, { kind: "upcoming", opponent: opp });
      } else if (opp === null) {
        weekMap.set(week, { kind: "bye" });
      } else {
        weekMap.set(week, { kind: "missed" });
      }
    }
    weeks.set(player.id, weekMap);
  }

  // every rank/projection below reads points through this one accessor
  const playedPts = (id: string): number[] => {
    const out: number[] = [];
    const weekMap = weeks.get(id);
    if (!weekMap) return out;
    for (const entry of weekMap.values())
      if (entry.kind === "played") out.push(entry.pts);
    return out;
  };

  // ranks: positional (all), overall (non-IDP pool; IDP ranked within IDP)
  const seasonRank = new Map<string, number>();
  const overallRank = new Map<string, number>();
  const byPos = new Map<string, { id: string; total: number }[]>();
  const poolAll: { id: string; total: number }[] = [];
  const poolIdp: { id: string; total: number }[] = [];
  for (const player of data.players) {
    const total = sum(playedPts(player.id));
    const arr = byPos.get(player.position) ?? [];
    arr.push({ id: player.id, total });
    byPos.set(player.position, arr);
    (["DB", "LB", "DL"].includes(player.position) ? poolIdp : poolAll).push({
      id: player.id,
      total,
    });
  }
  // sort descending by total; index+1 is the positional rank
  for (const arr of byPos.values()) {
    arr.sort((entryA, entryB) => entryB.total - entryA.total);
    arr.forEach((ranked, index) => seasonRank.set(ranked.id, index + 1));
  }
  for (const pool of [poolAll, poolIdp]) {
    pool.sort((entryA, entryB) => entryB.total - entryA.total);
    pool.forEach((ranked, index) => overallRank.set(ranked.id, index + 1));
  }

  // fantasy points allowed per defending team & position -> rank 1..32
  const fpaAcc = new Map<string, Map<string, { pts: number; games: number }>>();
  for (const team of data.teams) {
    const weekMap = new Map<string, { pts: number; games: number }>();
    for (const pos of ["QB", "RB", "WR", "TE", "K", "DEF", "DB", "LB", "DL"]) {
      weekMap.set(pos, { pts: 0, games: 0 });
    }
    fpaAcc.set(team.abbr, weekMap);
  }
  const posById = new Map(
    data.players.map((player) => [player.id, player.position]),
  );
  for (const weekMap of weeks.values()) {
    // played entries carry their line (and its opponent) directly
    for (const entry of weekMap.values()) {
      if (entry.kind !== "played" || !entry.line.opponent) continue;
      const cell = fpaAcc
        .get(entry.line.opponent)
        ?.get(posById.get(entry.line.playerId) ?? "");
      if (cell) {
        cell.pts += entry.pts;
        cell.games++;
      }
    }
  }
  const fpaRank = new Map<string, Map<string, number>>();
  const fpaAvg = new Map<string, Map<string, number>>();
  const fpaLeague = new Map<string, number>();
  for (const pos of ["QB", "RB", "WR", "TE", "K", "DEF", "DB", "LB", "DL"]) {
    const arr = data.teams.map((team) => {
      const cell = fpaAcc.get(team.abbr)?.get(pos);
      return {
        team: team.abbr,
        value: cell && cell.games ? cell.pts / cell.games : 0,
      };
    });
    fpaLeague.set(pos, mean(arr.map((item) => item.value)));
    // ascending: rank 1 allows the fewest points (Tough end of the scale)
    arr.sort((itemA, itemB) => itemA.value - itemB.value);
    arr.forEach(({ team, value }, index) => {
      const rm = fpaRank.get(team) ?? new Map<string, number>();
      rm.set(pos, index + 1);
      fpaRank.set(team, rm);
      const am = fpaAvg.get(team) ?? new Map<string, number>();
      am.set(pos, value);
      fpaAvg.set(team, am);
    });
  }

  // placeholder projection (Overview shared term) + nothing stored (ADR-0007)
  const projection = new Map<string, number | null>();
  for (const player of data.players) {
    if (!isCurrent) {
      projection.set(player.id, null);
      continue;
    }
    const opp = player.team
      ? (opponents.get(player.team)?.get(currentWeek) ?? null)
      : null;
    const prev = playedPts(player.id);
    if (
      opp == null ||
      player.injuryStatus === "O" ||
      player.injuryStatus === "IR" ||
      prev.length === 0
    ) {
      projection.set(player.id, null);
      continue;
    }
    const baseline = mean(prev);
    // Overview formula: baseline counts twice, then actual production
    const base = (2 * baseline + sum(prev)) / (2 + prev.length);
    const oppAvg = fpaAvg.get(opp)?.get(player.position);
    const lg = fpaLeague.get(player.position) ?? 1;
    const factor =
      oppAvg != null && lg > 0
        ? // opponent adjustment capped at ±15% (Overview shared term)
          Math.max(0.85, Math.min(1.15, 1 + 0.5 * (oppAvg / lg - 1)))
        : 1;
    projection.set(
      player.id,
      // questionable players take the Overview's 10% haircut
      Math.round(base * factor * (player.injuryStatus === "Q" ? 0.9 : 1) * 10) /
        10,
    );
  }

  return {
    season: data.season,
    isCurrent,
    playedWeeks,
    seasonWeeks,
    currentWeek,
    players: data.players,
    playerById: new Map(data.players.map((player) => [player.id, player])),
    teamsByAbbr,
    weeks,
    seasonRank,
    overallRank,
    fpaRank,
    fpaLeague,
    projection,
    results,
    opponents,
    teamPassAttempts,
    games: data.games,
  };
}

/** Matchup difficulty for a player's team at a week (Overview: ≤8 Tough,
 * ≥25 Easy). Null on a bye. */
export function matchup(
  model: SeasonModel,
  team: string | null,
  position: string,
  week: number,
): Matchup | null {
  if (!team) return null;
  const opponent = model.opponents.get(team)?.get(week) ?? null;
  if (opponent == null) return null;
  const rank = model.fpaRank.get(opponent)?.get(position) ?? 16;
  return {
    opponent,
    rank,
    label: rank >= 25 ? "Easy" : rank <= 8 ? "Tough" : "Even",
  };
}

/** Which played weeks fall in the active range (gaps excluded by nature). */
export function rangeWeeks(
  model: SeasonModel,
  playerId: string,
  range: RangeConfig,
): number[] {
  const weekMap = model.weeks.get(playerId);
  if (!weekMap) return [];
  const out: number[] = [];
  // custom bounds are order-insensitive: weeks 9–4 means 4–9
  const lo = range.kind === "custom" ? Math.min(range.from, range.to) : 1;
  const hi =
    range.kind === "custom"
      ? Math.max(range.from, range.to)
      : model.seasonWeeks;
  for (const [week, entry] of weekMap) {
    if (entry.kind === "played" && week >= lo && week <= hi) out.push(week);
  }
  return out.sort((valueA, valueB) => valueA - valueB);
}

/** All stats a row/card shows over the range (prototype pstats, typed). */
export function playerRangeStats(
  model: SeasonModel,
  playerId: string,
  range: RangeConfig,
): PlayerRangeStats {
  const weekMap = model.weeks.get(playerId);
  const rw = rangeWeeks(model, playerId, range);
  const entries = rw
    .map((week) => weekMap?.get(week))
    .filter(
      (entry): entry is Extract<WeekEntry, { kind: "played" }> =>
        entry?.kind === "played",
    );
  const vals = entries.map((entry) => entry.pts);
  const lines = entries.map((entry) => entry.line);

  // TGT% denominator from the model's precomputed team pass attempts (O(1))
  const teamAtt = (team: string, week: number): number =>
    Math.max(1, model.teamPassAttempts.get(`${team}|${String(week)}`) ?? 0);

  const snaps = lines
    .map((line) => line.snapPct)
    .filter((statSnap): statSnap is number => statSnap != null);
  const tgtPcts: number[] = [];
  for (const line of lines) {
    if (
      line.position === "RB" ||
      line.position === "WR" ||
      line.position === "TE"
    ) {
      tgtPcts.push(line.targets / teamAtt(line.teamPlayedFor, line.week));
    }
  }

  const num = (
    getValue: (line: StatLine) => number | null | undefined,
  ): number => sum(lines.map((line) => getValue(line) ?? 0));
  const avgOf = (
    getValue: (line: StatLine) => number | null | undefined,
  ): number | null => {
    const xs = lines
      .map(getValue)
      .filter((value): value is number => value != null);
    return xs.length ? mean(xs) : null;
  };
  const agg: RangeAgg = {
    fgm: num((line) => (line.position === "K" ? line.fgMade : 0)),
    fga: num((line) =>
      line.position === "K" ? line.fgMade + line.fgMissed : 0,
    ),
    xpm: num((line) => (line.position === "K" ? line.xpMade : 0)),
    lng50: num((line) => (line.position === "K" ? line.fg50Plus : 0)),
    sk: num((line) =>
      "sacks" in line ? line.sacks : line.position === "QB" ? 0 : 0,
    ),
    int: num((line) =>
      "interceptions" in line && line.position !== "QB"
        ? line.interceptions
        : 0,
    ),
    fr: num((line) => ("fumbleRecoveries" in line ? line.fumbleRecoveries : 0)),
    td: num((line) => ("tds" in line ? line.tds : 0)),
    pa: avgOf((line) => (line.position === "DEF" ? line.pointsAllowed : null)),
    ya: avgOf((line) => (line.position === "DEF" ? line.yardsAllowed : null)),
    solo: num((line) => ("soloTackles" in line ? line.soloTackles : 0)),
    ast: num((line) => ("assistTackles" in line ? line.assistTackles : 0)),
    tkl: num((line) =>
      "soloTackles" in line ? line.soloTackles + line.assistTackles : 0,
    ),
    pd: num((line) => ("passesDefended" in line ? line.passesDefended : 0)),
    car: num((line) => ("carries" in line ? line.carries : 0)),
    ryd: num((line) => ("rushYards" in line ? line.rushYards : 0)),
    tgt: num((line) => ("targets" in line ? line.targets : 0)),
    rec: num((line) => ("receptions" in line ? line.receptions : 0)),
    cyd: num((line) => ("recYards" in line ? line.recYards : 0)),
    fd: num((line) => ("firstDowns" in line ? line.firstDowns : 0)),
    patt: num((line) => (line.position === "QB" ? line.attempts : 0)),
    pcmp: num((line) => (line.position === "QB" ? line.completions : 0)),
    pyd: num((line) => (line.position === "QB" ? line.passYards : 0)),
    ptd: num((line) => (line.position === "QB" ? line.passTds : 0)),
    aysh: avgOf((line) =>
      "airYardsShare" in line ? line.airYardsShare : null,
    ),
    wopr: avgOf((line) => ("wopr" in line ? line.wopr : null)),
    tgtsh: avgOf((line) => ("targetShare" in line ? line.targetShare : null)),
  };

  const position = model.playerById.get(playerId)?.position ?? "";
  const oppRank = (line: StatLine): number =>
    line.opponent
      ? (model.fpaRank.get(line.opponent)?.get(position) ?? 16)
      : 16;
  const splitAvg = (
    getValue: (line: StatLine) => boolean,
  ): SplitCell | null => {
    const xs = entries
      .filter((entry) => getValue(entry.line))
      .map((entry) => entry.pts);
    return xs.length ? { ppg: mean(xs), games: xs.length } : null;
  };

  // trend: last 3 played (season-wide) vs the mean before them
  const allPlayed: number[] = [];
  if (weekMap)
    for (const entry of weekMap.values())
      if (entry.kind === "played") allPlayed.push(entry.pts);
  // trend compares the last 3 played games against everything before them
  const trend =
    allPlayed.length >= 4
      ? mean(allPlayed.slice(-3)) - mean(allPlayed.slice(0, -3))
      : 0;

  return {
    gp: vals.length,
    total: sum(vals),
    avg: vals.length ? mean(vals) : null,
    high: vals.length ? Math.max(...vals) : null,
    low: vals.length ? Math.min(...vals) : null,
    sd: vals.length >= 3 ? sdev(vals) : null,
    snap: snaps.length ? mean(snaps) : null,
    tgt: tgtPcts.length ? mean(tgtPcts) * 100 : null,
    trend,
    agg,
    split: {
      home: splitAvg((line) => line.home),
      away: splitAvg((line) => !line.home),
      tough: splitAvg((line) => oppRank(line) <= 8),
      easy: splitAvg((line) => oppRank(line) >= 25),
    },
  };
}

/** Shared stats helpers for card charts. */
export const stats = { sum, mean, sdev };
