/** Sample-source tests (foundation spec §6.4): deterministic, contract-shaped,
 * gaps-not-zeros preserved (byes and missed weeks have no line at all). */
import { expect, test } from "vitest";
import { buildSeason, SAMPLE } from "./world";

test("current season: 32 teams, 640 players, deterministic across calls", () => {
  const first = buildSeason(SAMPLE.season);
  expect(first.teams).toHaveLength(32);
  expect(first.players).toHaveLength(640);
  const second = buildSeason(SAMPLE.season);
  expect(second).toBe(first); // memoized
});

test("lines exist only for played weeks and never on a bye", () => {
  const data = buildSeason(SAMPLE.season);
  const byBye = new Map(data.teams.map((team) => [team.abbr, team.byeWeek]));
  for (const line of data.statLines.slice(0, 2000)) {
    expect(line.week).toBeLessThanOrEqual(SAMPLE.playedWeeks);
    expect(byBye.get(line.teamPlayedFor)).not.toBe(line.week);
  }
});

test("per-position types carry their own fields (PE4)", () => {
  const data = buildSeason(SAMPLE.season);
  const qb = data.statLines.find((line) => line.position === "QB");
  const kicker = data.statLines.find((line) => line.position === "K");
  const def = data.statLines.find((line) => line.position === "DEF");
  expect(qb && "passYards" in qb).toBe(true);
  expect(kicker && "fgMade" in kicker).toBe(true);
  expect(def && "pointsAllowed" in def).toBe(true);
});

test("prior seasons: all 18 weeks final, rookies-to-be excluded", () => {
  const data = buildSeason(2023);
  expect(data.games.every((game) => game.final)).toBe(true);
  const cur = buildSeason(SAMPLE.season);
  const newcomers = cur.players.filter(
    (player) => (player.rookieYear ?? 0) > 2023 && player.position !== "DEF",
  );
  const ids = new Set(data.players.map((player) => player.id));
  for (const player of newcomers.slice(0, 20))
    expect(ids.has(player.id)).toBe(false);
});

test("games join: every stat line's team has a game that week", () => {
  const data = buildSeason(SAMPLE.season);
  const byWeek = new Map<string, boolean>();
  for (const game of data.games) {
    byWeek.set(`${String(game.week)}:${game.homeTeam}`, true);
    byWeek.set(`${String(game.week)}:${game.awayTeam}`, true);
  }
  for (const line of data.statLines.slice(0, 2000)) {
    expect(byWeek.get(`${String(line.week)}:${line.teamPlayedFor}`)).toBe(true);
  }
});
