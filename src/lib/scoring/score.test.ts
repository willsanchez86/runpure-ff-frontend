/** Scoring golden tests (ADR-0007's accepted cost: the app holds AND TESTS
 * scoring logic). One hand-computed case per position and per switch option. */
import { expect, test } from "vitest";
import type {
  DefStatLine,
  IdpStatLine,
  KStatLine,
  QbStatLine,
  RbStatLine,
  WrTeStatLine,
} from "@/lib/api/contract";
import { score } from "./score";

const base = {
  playerId: "p1",
  week: 1,
  teamPlayedFor: "KC",
  opponent: "DEN",
  home: true,
  snapPct: 90,
};
const STD = { fmt: "std", tePrem: false, ptd6: false } as const;
const PPR = { fmt: "ppr", tePrem: false, ptd6: false } as const;

const qb: QbStatLine = {
  ...base,
  position: "QB",
  attempts: 30,
  completions: 20,
  passYards: 300,
  passTds: 2,
  interceptions: 1,
  sacksTaken: 2,
  sackYards: 12,
  carries: 4,
  rushYards: 20,
  rushTds: 1,
  fumbles: 1,
  fumblesLost: 0,
  firstDowns: 12,
};

test("QB: 300/2/1 passing + 20 rush + rush TD − fumble, 4pt vs 6pt pass TD", () => {
  // 300*.04=12 + 2*4=8 − 2 + 20*.1=2 + 6 − 2 = 24
  expect(score(qb, STD)).toBe(24);
  // 6-pt pass TDs add 2*2=4
  expect(score(qb, { ...STD, ptd6: true })).toBe(28);
});

const rb: RbStatLine = {
  ...base,
  position: "RB",
  carries: 18,
  rushYards: 90,
  rushTds: 1,
  targets: 5,
  receptions: 4,
  recYards: 30,
  recTds: 0,
  fumbles: 0,
  fumblesLost: 0,
  firstDowns: 7,
  targetShare: 0.1,
  airYardsShare: 0.02,
  wopr: 0.18,
};

test("RB: rushing + receiving; receptions count per format", () => {
  // std: 9 + 6 + 3 = 18 · ppr adds 4
  expect(score(rb, STD)).toBe(18);
  expect(score(rb, PPR)).toBe(22);
  expect(score(rb, { fmt: "half", tePrem: false, ptd6: false })).toBe(20);
});

const te: WrTeStatLine = {
  ...base,
  position: "TE",
  targets: 8,
  receptions: 6,
  recYards: 60,
  recTds: 1,
  carries: 0,
  rushYards: 0,
  fumbles: 0,
  fumblesLost: 0,
  firstDowns: 4,
  targetShare: 0.2,
  airYardsShare: 0.18,
  wopr: 0.43,
};

test("TE premium adds half a point per catch, on top of the format", () => {
  // ppr: 6 + 6 + 6 = 18; tePrem: +3
  expect(score(te, PPR)).toBe(18);
  expect(score(te, { fmt: "ppr", tePrem: true, ptd6: false })).toBe(21);
});

const k: KStatLine = {
  ...base,
  position: "K",
  snapPct: null,
  fgMade: 3,
  fgMissed: 1,
  fg50Plus: 1,
  xpMade: 2,
};

test("K: 3 per FG, +2 per 50+, +1 per XP, −1 per miss", () => {
  expect(score(k, STD)).toBe(9 + 2 + 2 - 1);
});

test("DEF: points-allowed tiers hit every band", () => {
  const def = (pa: number): DefStatLine => ({
    ...base,
    position: "DEF",
    snapPct: null,
    pointsAllowed: pa,
    yardsAllowed: 300,
    sacks: 0,
    interceptions: 0,
    fumbleRecoveries: 0,
    tds: 0,
    safeties: 0,
  });
  expect(score(def(0), STD)).toBe(10);
  expect(score(def(6), STD)).toBe(7);
  expect(score(def(13), STD)).toBe(4);
  expect(score(def(20), STD)).toBe(1);
  expect(score(def(27), STD)).toBe(0);
  expect(score(def(34), STD)).toBe(-1);
  expect(score(def(40), STD)).toBe(-4);
});

test("IDP: Overview default scoring incl. half-point TFL and assists", () => {
  const lb: IdpStatLine = {
    ...base,
    position: "LB",
    soloTackles: 6,
    assistTackles: 4,
    sacks: 1,
    tacklesForLoss: 2,
    interceptions: 1,
    passesDefended: 2,
    forcedFumbles: 1,
    fumbleRecoveries: 0,
    qbHits: 1,
    tds: 0,
  };
  // 6 + 2 + 2 + 1 + 3 + 2 + 2 + 0 + 0 = 18
  expect(score(lb, STD)).toBe(18);
});

test("scoring format never changes K / DEF / IDP points", () => {
  expect(score(k, PPR)).toBe(score(k, STD));
});
