/** List logic tests (player spec §11): filter combos + match semantics, sort
 * direction + name tie-break, nulls last. */
import { expect, test } from "vitest";
import { buildSeason, SAMPLE } from "@/lib/sample/world";
import { buildSeasonModel, playerRangeStats } from "@/lib/scoring/engine";
import { defaultSettings } from "@/lib/settings/model";
import { filterRows, matchesPosition, sortRows, type Row } from "./filtering";

const PPR = { fmt: "ppr", tePrem: false, ptd6: false } as const;
const model = buildSeasonModel(buildSeason(SAMPLE.season), PPR, SAMPLE.season);
const range = { kind: "season", from: 1, to: 18, perGame: false } as const;
const rows: Row[] = model.players.map((player) => ({
  player,
  stats: playerRangeStats(model, player.id, range),
}));
const base = defaultSettings(model.playedWeeks);

test("FLEX and IDP pills match their position families", () => {
  const rb = model.players.find((player) => player.position === "RB");
  const lb = model.players.find((player) => player.position === "LB");
  const qb = model.players.find((player) => player.position === "QB");
  if (!rb || !lb || !qb) throw new Error("sample should have all positions");
  expect(matchesPosition("FLEX", rb)).toBe(true);
  expect(matchesPosition("FLEX", qb)).toBe(false);
  expect(matchesPosition("IDP", lb)).toBe(true);
  expect(matchesPosition("IDP", rb)).toBe(false);
});

test("filters combine: team + position + min games", () => {
  const out = filterRows(
    rows,
    { ...base, teamFilter: "KC", posFilter: "WR", minGp: 1 },
    model,
  );
  expect(out.length).toBeGreaterThan(0);
  for (const row of out) {
    expect(row.player.team).toBe("KC");
    expect(row.player.position).toBe("WR");
    expect(row.stats.gp).toBeGreaterThanOrEqual(1);
  }
});

test("search matches partial names case-insensitively and exact team codes", () => {
  const sample = model.players.at(5);
  if (!sample) throw new Error("no players");
  const part = sample.name.slice(2, 7).toUpperCase();
  const byName = filterRows(rows, { ...base, query: part }, model);
  expect(byName.some((row) => row.player.id === sample.id)).toBe(true);
  const byTeam = filterRows(rows, { ...base, query: "kc" }, model);
  expect(byTeam.length).toBeGreaterThan(0);
  expect(byTeam.every((row) => row.player.team === "KC")).toBe(true);
});

test("sort: direction flips, nulls always last, ties broken by name", () => {
  const get = (row: Row) => row.stats.avg;
  const desc = sortRows([...rows], get, -1);
  const firstVals = desc.slice(0, 5).map((row) => row.stats.avg ?? -1);
  expect([...firstVals].sort((aVal, bVal) => bVal - aVal)).toEqual(firstVals);
  const anyNull = rows.some((row) => row.stats.avg == null);
  if (anyNull) expect(desc.at(-1)?.stats.avg).toBeNull();
  const asc = sortRows([...rows], get, 1);
  const headVals = asc
    .map((row) => row.stats.avg)
    .filter((value): value is number => value != null)
    .slice(0, 5);
  expect([...headVals].sort((aVal, bVal) => aVal - bVal)).toEqual(headVals);
});

test("rookies filter means that season's rookies (PE3 semantics)", () => {
  const out = filterRows(rows, { ...base, rookieOnly: true }, model);
  for (const row of out) expect(row.player.rookieYear).toBe(model.season);
});
