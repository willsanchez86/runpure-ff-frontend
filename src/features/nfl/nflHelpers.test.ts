/** NFL helper tests (NFL spec §9): defaults across the season's life,
 * slate selection and ordering, byes, formatting and gaps. */
import { describe, expect, it } from "vitest";
import type { Game } from "@/lib/api/contract";
import type { TeamInfo } from "@/lib/scoring/types";
import {
  byeTeams,
  defaultSlate,
  favoriteText,
  gamesFor,
  gap,
  kickoffParts,
  phaseDefaultWeek,
  phaseWeeks,
} from "./nflHelpers";

/** A minimal game; overrides shape each case. */
function game(over: Partial<Game>): Game {
  return {
    id: "2026_01_AAA_BBB",
    season: 2026,
    phase: "REG",
    week: 1,
    kickoff: "2026-09-13T17:00:00.000Z",
    homeTeam: "BBB",
    awayTeam: "AAA",
    homeScore: null,
    awayScore: null,
    overtime: false,
    final: false,
    stadium: null,
    roof: null,
    surface: null,
    temperatureF: null,
    windMph: null,
    spreadLine: null,
    totalLine: null,
    favorite: null,
    homeQb: null,
    awayQb: null,
    homeCoach: null,
    awayCoach: null,
    homeRestDays: null,
    awayRestDays: null,
    divisionGame: false,
    ...over,
  };
}

function team(abbr: string, byeWeek: number): TeamInfo {
  return {
    abbr,
    name: `The ${abbr}`,
    division: "NFC Test",
    byeWeek,
    roof: null,
    surface: null,
    stadium: null,
    logoUrl: null,
    color: null,
  };
}

describe("defaultSlate (NS1)", () => {
  it("mid-season: regular season, first week with an unplayed game", () => {
    const games = [
      game({ week: 9, final: true }),
      game({ id: "a", week: 10, final: true }),
      game({ id: "b", week: 10, final: false }),
      game({ id: "c", week: 11 }),
    ];
    expect(defaultSlate(games)).toEqual({ phase: "REG", week: 10 });
  });

  it("regular season over: postseason once it starts", () => {
    const games = [
      game({ week: 18, final: true }),
      game({ id: "wc", phase: "POST", week: 19, final: true }),
      game({ id: "dv", phase: "POST", week: 20, final: false }),
    ];
    expect(defaultSlate(games)).toEqual({ phase: "POST", week: 20 });
  });

  it("season fully played: last postseason week", () => {
    const games = [
      game({ week: 18, final: true }),
      game({ id: "sb", phase: "POST", week: 22, final: true }),
    ];
    expect(defaultSlate(games)).toEqual({ phase: "POST", week: 22 });
  });

  it("no postseason in the feed: last regular-season week", () => {
    const games = [
      game({ week: 17, final: true }),
      game({ id: "z", week: 18, final: true }),
    ];
    expect(defaultSlate(games)).toEqual({ phase: "REG", week: 18 });
  });
});

describe("phase navigation", () => {
  it("phaseWeeks lists a phase's distinct weeks ascending", () => {
    const games = [
      game({ week: 3 }),
      game({ id: "a", week: 1 }),
      game({ id: "b", week: 3 }),
      game({ id: "c", phase: "POST", week: 19 }),
    ];
    expect(phaseWeeks(games, "REG")).toEqual([1, 3]);
    expect(phaseWeeks(games, "POST")).toEqual([19]);
    expect(phaseWeeks(games, "PRE")).toEqual([]);
  });

  it("a hand-picked phase opens on its first unplayed week", () => {
    const games = [
      game({ phase: "POST", week: 19, final: true }),
      game({ id: "a", phase: "POST", week: 20, final: false }),
    ];
    expect(phaseDefaultWeek(games, "POST")).toBe(20);
    // fully played phase opens on its last week
    expect(phaseDefaultWeek([game({ week: 5, final: true })], "REG")).toBe(5);
  });
});

describe("gamesFor", () => {
  it("filters to the slate and orders by kickoff", () => {
    const games = [
      game({ id: "late", week: 2, kickoff: "2026-09-21T00:20:00.000Z" }),
      game({ id: "early", week: 2, kickoff: "2026-09-20T17:00:00.000Z" }),
      game({ id: "other-week", week: 3 }),
      game({ id: "post", phase: "POST", week: 2 }),
    ];
    const slate = gamesFor(games, { phase: "REG", week: 2 });
    expect(slate.map((g) => g.id)).toEqual(["early", "late"]);
  });
});

describe("byeTeams (NS3)", () => {
  const teams = [team("ZZZ", 10), team("AAA", 10), team("BBB", 7)];
  it("lists the week's bye teams sorted by abbreviation", () => {
    const byes = byeTeams(teams, { phase: "REG", week: 10 });
    expect(byes.map((t) => t.abbr)).toEqual(["AAA", "ZZZ"]);
  });
  it("byes exist only in the regular season", () => {
    expect(byeTeams(teams, { phase: "POST", week: 10 })).toEqual([]);
  });
});

describe("formatting", () => {
  it("kickoffParts renders Eastern time", () => {
    // 18:00 UTC in November is 1:00 PM EST
    const parts = kickoffParts("2026-11-15T18:00:00.000Z");
    expect(parts.day).toContain("Nov 15");
    expect(parts.time).toBe("1:00 PM");
  });

  it("invalid kickoff renders as gaps", () => {
    expect(kickoffParts("not-a-date")).toEqual({ day: "—", time: "—" });
  });

  it("favoriteText formats the line, null when the feed has none", () => {
    expect(favoriteText(game({ favorite: "KC", spreadLine: 3.5 }))).toBe(
      "KC −3.5",
    );
    expect(favoriteText(game({}))).toBeNull();
  });

  it("gap renders missing values as dashes, never zeros", () => {
    expect(gap(null)).toBe("—");
    expect(gap(0, "°F")).toBe("0°F");
    expect(gap(12, " mph")).toBe("12 mph");
  });
});
