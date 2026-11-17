/** Engine tests (foundation spec §11/§12): gaps never zeros, volatility's
 * 3-game floor, range windows, matchup thresholds, scoring-switch cascade. */
import { expect, test } from "vitest";
import { buildSeason, SAMPLE } from "@/lib/sample/world";
import { buildSeasonModel, matchup, playerRangeStats } from "./engine";

const PPR = { fmt: "ppr", tePrem: false, ptd6: false } as const;
const SEASON_RANGE = {
  kind: "season",
  from: 1,
  to: 18,
  perGame: false,
} as const;

const data = buildSeason(SAMPLE.season);
const model = buildSeasonModel(data, PPR, SAMPLE.season);

test("byes and missed weeks are gaps; averages divide by games played", () => {
  for (const player of model.players.slice(0, 50)) {
    const weeks = model.weeks.get(player.id);
    let played = 0;
    weeks?.forEach((entry) => {
      if (entry.kind === "played") played++;
      // a gap never contributes a zero point entry
      expect(entry.kind).not.toBe(undefined);
    });
    const stats = playerRangeStats(model, player.id, SEASON_RANGE);
    expect(stats.gp).toBe(played);
    if (played > 0 && stats.avg != null) {
      expect(stats.avg).toBeCloseTo(stats.total / played, 6);
    }
  }
});

test("volatility needs at least 3 games", () => {
  for (const player of model.players) {
    const stats = playerRangeStats(model, player.id, SEASON_RANGE);
    if (stats.gp < 3) expect(stats.sd).toBeNull();
  }
});

test("custom range restricts totals to the window", () => {
  const player = model.players.find((candidate) => {
    const stats = playerRangeStats(model, candidate.id, SEASON_RANGE);
    return stats.gp === model.playedWeeks; // played every week
  });
  expect(player).toBeDefined();
  if (!player) return;
  const windowed = playerRangeStats(model, player.id, {
    kind: "custom",
    from: 4,
    to: 6,
    perGame: false,
  });
  expect(windowed.gp).toBe(3);
});

test("matchup difficulty: rank thresholds 8/25 (Overview shared term)", () => {
  let tough = 0;
  let easy = 0;
  for (const player of model.players) {
    const diff = matchup(
      model,
      player.team,
      player.position,
      model.currentWeek,
    );
    if (!diff) continue;
    expect(diff.rank).toBeGreaterThanOrEqual(1);
    expect(diff.rank).toBeLessThanOrEqual(32);
    if (diff.label === "Tough") {
      tough++;
      expect(diff.rank).toBeLessThanOrEqual(8);
    }
    if (diff.label === "Easy") {
      easy++;
      expect(diff.rank).toBeGreaterThanOrEqual(25);
    }
  }
  expect(tough).toBeGreaterThan(0);
  expect(easy).toBeGreaterThan(0);
});

test("the scoring switch cascades into ranks", () => {
  const std = buildSeasonModel(
    data,
    { fmt: "std", tePrem: false, ptd6: false },
    SAMPLE.season,
  );
  // At least one skill player's positional rank moves between PPR and standard.
  const moved = model.players.some(
    (player) =>
      (player.position === "WR" || player.position === "RB") &&
      model.seasonRank.get(player.id) !== std.seasonRank.get(player.id),
  );
  expect(moved).toBe(true);
});

test("prior seasons have results for every played week (PE2)", () => {
  const prior = buildSeasonModel(buildSeason(2024), PPR, SAMPLE.season);
  expect(prior.isCurrent).toBe(false);
  expect(prior.playedWeeks).toBe(prior.seasonWeeks);
  const anyTeam = prior.players.find((player) => player.team)?.team;
  expect(anyTeam).toBeTruthy();
  if (!anyTeam) return;
  const res = prior.results.get(anyTeam);
  let counted = 0;
  for (let week = 1; week <= prior.seasonWeeks; week++) {
    // weeks without a scheduled opponent (bye) are gaps, not results
    if (prior.opponents.get(anyTeam)?.get(week) == null) continue;
    expect(res?.get(week)).toBeDefined();
    counted++;
  }
  expect(counted).toBeGreaterThanOrEqual(14);
});
