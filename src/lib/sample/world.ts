/** Sample data source generator — a port of the Phase 1 prototype's data.js
 * (foundation spec §6.4, P6) emitting the contract shapes of the player spec
 * §9 / NFL spec §6. Deterministic: identities are seeded once; each season is
 * seeded by its year; each player's season stream by (id, year), so results
 * are identical regardless of which season a screen fetches first.
 *
 * Sample-mode limits (lifted by the real API at contract cut-over): regular
 * season only (no PRE/POST games), and injury status exists only for the
 * current season. */
import type {
  Game,
  Player,
  Position,
  SeasonData,
  StatLine,
  Team,
} from "@/lib/api/contract";
import { clamp, hash2, Rng } from "./rng";

/** The sample world's clock (prototype: 2026 season, week 10 current). */
export const SAMPLE = {
  season: 2026,
  currentWeek: 10,
  playedWeeks: 9,
  seasonWeeks: 18,
  firstSeason: 2022,
  lastUpdated: "2026-11-10T06:00:00-05:00",
} as const;

/* ---- static NFL facts (teams are real; every player is fictional) ---- */
const RAW_TEAMS: [
  string,
  string,
  string,
  string,
  string,
  string,
  Team["roof"],
  Team["surface"],
][] = [
  [
    "ARI",
    "Arizona",
    "Cardinals",
    "NFC",
    "West",
    "State Farm Stadium",
    "retractable",
    "grass",
  ],
  [
    "ATL",
    "Atlanta",
    "Falcons",
    "NFC",
    "South",
    "Mercedes-Benz Stadium",
    "dome",
    "turf",
  ],
  [
    "BAL",
    "Baltimore",
    "Ravens",
    "AFC",
    "North",
    "M&T Bank Stadium",
    "open",
    "grass",
  ],
  [
    "BUF",
    "Buffalo",
    "Bills",
    "AFC",
    "East",
    "Highmark Stadium",
    "open",
    "turf",
  ],
  [
    "CAR",
    "Carolina",
    "Panthers",
    "NFC",
    "South",
    "Bank of America Stadium",
    "open",
    "turf",
  ],
  ["CHI", "Chicago", "Bears", "NFC", "North", "Soldier Field", "open", "grass"],
  [
    "CIN",
    "Cincinnati",
    "Bengals",
    "AFC",
    "North",
    "Paycor Stadium",
    "open",
    "turf",
  ],
  [
    "CLE",
    "Cleveland",
    "Browns",
    "AFC",
    "North",
    "Huntington Bank Field",
    "open",
    "grass",
  ],
  [
    "DAL",
    "Dallas",
    "Cowboys",
    "NFC",
    "East",
    "AT&T Stadium",
    "retractable",
    "turf",
  ],
  ["DEN", "Denver", "Broncos", "AFC", "West", "Empower Field", "open", "grass"],
  ["DET", "Detroit", "Lions", "NFC", "North", "Ford Field", "dome", "turf"],
  [
    "GB",
    "Green Bay",
    "Packers",
    "NFC",
    "North",
    "Lambeau Field",
    "open",
    "grass",
  ],
  [
    "HOU",
    "Houston",
    "Texans",
    "AFC",
    "South",
    "NRG Stadium",
    "retractable",
    "turf",
  ],
  [
    "IND",
    "Indianapolis",
    "Colts",
    "AFC",
    "South",
    "Lucas Oil Stadium",
    "retractable",
    "turf",
  ],
  [
    "JAX",
    "Jacksonville",
    "Jaguars",
    "AFC",
    "South",
    "EverBank Stadium",
    "open",
    "grass",
  ],
  [
    "KC",
    "Kansas City",
    "Chiefs",
    "AFC",
    "West",
    "Arrowhead Stadium",
    "open",
    "grass",
  ],
  [
    "LV",
    "Las Vegas",
    "Raiders",
    "AFC",
    "West",
    "Allegiant Stadium",
    "dome",
    "grass",
  ],
  [
    "LAC",
    "Los Angeles",
    "Chargers",
    "AFC",
    "West",
    "SoFi Stadium",
    "dome",
    "turf",
  ],
  ["LAR", "Los Angeles", "Rams", "NFC", "West", "SoFi Stadium", "dome", "turf"],
  [
    "MIA",
    "Miami",
    "Dolphins",
    "AFC",
    "East",
    "Hard Rock Stadium",
    "open",
    "grass",
  ],
  [
    "MIN",
    "Minnesota",
    "Vikings",
    "NFC",
    "North",
    "U.S. Bank Stadium",
    "dome",
    "turf",
  ],
  [
    "NE",
    "New England",
    "Patriots",
    "AFC",
    "East",
    "Gillette Stadium",
    "open",
    "turf",
  ],
  [
    "NO",
    "New Orleans",
    "Saints",
    "NFC",
    "South",
    "Caesars Superdome",
    "dome",
    "turf",
  ],
  [
    "NYG",
    "New York",
    "Giants",
    "NFC",
    "East",
    "MetLife Stadium",
    "open",
    "turf",
  ],
  ["NYJ", "New York", "Jets", "AFC", "East", "MetLife Stadium", "open", "turf"],
  [
    "PHI",
    "Philadelphia",
    "Eagles",
    "NFC",
    "East",
    "Lincoln Financial Field",
    "open",
    "grass",
  ],
  [
    "PIT",
    "Pittsburgh",
    "Steelers",
    "AFC",
    "North",
    "Acrisure Stadium",
    "open",
    "grass",
  ],
  [
    "SF",
    "San Francisco",
    "49ers",
    "NFC",
    "West",
    "Levi's Stadium",
    "open",
    "grass",
  ],
  ["SEA", "Seattle", "Seahawks", "NFC", "West", "Lumen Field", "open", "turf"],
  [
    "TB",
    "Tampa Bay",
    "Buccaneers",
    "NFC",
    "South",
    "Raymond James Stadium",
    "open",
    "grass",
  ],
  [
    "TEN",
    "Tennessee",
    "Titans",
    "AFC",
    "South",
    "Nissan Stadium",
    "open",
    "grass",
  ],
  [
    "WAS",
    "Washington",
    "Commanders",
    "NFC",
    "East",
    "Northwest Stadium",
    "open",
    "grass",
  ],
];
// prettier-ignore
const COACHES = ["R. Delgado","T. Okafor","M. Vanderbilt","S. Pruett","J. Castellano","B. Whitfield","A. Lindqvist","D. Mercer","C. Rourke","E. Fairbanks","N. Abernathy","G. Sutter","L. Esposito","P. Hartwell","K. Ibarra","W. Jessup","F. Northcutt","H. Quarles","V. Radcliffe","O. Treadwell","Z. Valentin","Y. Wexler","Q. Yarbrough","U. Zeller","M. Barrow","R. Coldwell","T. Draper","J. Ellery","B. Forsythe","A. Garrity","S. Haskins","D. Ingram"];
// prettier-ignore
const FIRST = ["Marcus","Devon","Tyrell","Jalen","Cole","Brady","Isaiah","Malik","Trey","Darius","Logan","Jaxon","Caleb","Andre","Rashad","Quinn","Elijah","Xavier","Damon","Kendall","Bryce","Tavon","Myles","Corey","Dante","Terrence","Luca","Nate","Reggie","Omar","Shane","Keenan","Austin","Grant","Jordan","Micah","Desmond","Hunter","Roman","Zane","Tobias","Emmett","Silas","Felix","Cyrus","Owen","Reid","Carter","Mason","Wes","Jace","Kai","Rocco","Beau","Hayes","Ellis","Nico","Tate","Royce","Abram","Deshawn","Amari","Jaylen","Keon","Trevon","Donovan","Khalil","Rashawn","Jabari","Demetrius"];
// prettier-ignore
const LAST = ["Holloway","Brennan","Okafor","Whitfield","Castellano","Ashby","Delacroix","Pruitt","Vance","Mercer","Oduya","Talbot","Kincaid","Rourke","Fairbanks","Lindqvist","Abernathy","Sutter","Morrow","Esposito","Dukes","Galloway","Hartwell","Ibarra","Jessup","Kowalczyk","Lattimore","Mbeki","Northcutt","Okoye","Pemberton","Quarles","Radcliffe","Strand","Treadwell","Ulloa","Valentin","Wexler","Yarbrough","Zeller","Barrow","Coldwell","Draper","Ellery","Forsythe","Garrity","Haskins","Ingram","Jolley","Keane","Lusk","Mayfield","Nolte","Ochoa","Pickett","Rand","Sorensen","Thibault","Upshaw","Vickers","Wainwright","Yancey","Ashworth","Blaylock","Crane","Dorsey","Easley","Fennimore","Goodwin","Hatcher","Irwin","Judd","Kessler","Locke","Maddox","Nunez","Osei","Prater","Ridley","Stroud"];
// prettier-ignore
const COLLEGES = ["Alabama","Ohio State","Georgia","LSU","Michigan","Clemson","Oklahoma","Texas","Notre Dame","Penn State","Florida","Oregon","USC","Wisconsin","Iowa","Tennessee","Ole Miss","Washington","Miami","TCU","Utah","North Carolina","Pittsburgh","Baylor","Kansas State","Boise State","Appalachian State","North Dakota State","Montana","Jackson State"];

const RANGES: Record<
  string,
  { ht: [number, number]; wt: [number, number]; jer: [number, number] }
> = {
  QB: { ht: [74, 78], wt: [215, 245], jer: [1, 19] },
  RB: { ht: [68, 72], wt: [200, 230], jer: [20, 39] },
  WR: { ht: [70, 76], wt: [185, 215], jer: [10, 19] },
  TE: { ht: [76, 79], wt: [245, 265], jer: [80, 89] },
  K: { ht: [70, 74], wt: [185, 210], jer: [1, 9] },
  DB: { ht: [69, 74], wt: [185, 210], jer: [20, 39] },
  LB: { ht: [72, 75], wt: [230, 250], jer: [40, 59] },
  DL: { ht: [74, 78], wt: [280, 320], jer: [90, 99] },
};

/** Internal identity: a player plus the generator's hidden signal knobs. */
export interface SamplePlayer extends Player {
  /** Share of his position's workload (1 = clear starter). */
  role: number;
  /** Receiving involvement multiplier (RBs mostly). */
  recv: number;
  /** QB mobility: drives designed runs and scramble yards. */
  mob: number;
  /** Underlying quality multiplier around 1.0. */
  talent: number;
  /** Depth-chart slot within team+position (1 = starter). */
  depth: number;
  /** Edge case: just-signed rookie with zero games (sparse-data state). */
  rookieNoGames: boolean;
}

interface Identity {
  teams: Omit<Team, "byeWeek">[];
  abbrs: string[];
  players: SamplePlayer[];
}

let identityMemo: Identity | null = null;

/** Builds the season-independent universe once: 32 teams, 640 players. */
export function identity(): Identity {
  if (identityMemo) return identityMemo;
  const rng = new Rng(20261110);
  const teams = RAW_TEAMS.map((rawTeam, teamIndex) => ({
    abbr: rawTeam[0],
    city: rawTeam[1],
    nickname: rawTeam[2],
    name: `${rawTeam[1]} ${rawTeam[2]}`,
    conference: rawTeam[3],
    division: `${rawTeam[3]} ${rawTeam[4]}`,
    stadium: rawTeam[5],
    roof: rawTeam[6],
    surface: rawTeam[7],
    headCoach: COACHES[teamIndex] ?? "—",
    logoUrl: null,
    color: null,
  }));
  const abbrs = teams.map((team) => team.abbr);
  const used = new Set<string>();
  const pname = (): string => {
    let n: string;
    do {
      n = `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
    } while (used.has(n));
    used.add(n);
    return n;
  };
  const players: SamplePlayer[] = [];
  let pid = 0;
  const mk = (pos: Position, team: string, role: number, recv = 1, mob = 0) => {
    const rg = RANGES[pos] ?? { ht: [72, 76], wt: [210, 240], jer: [1, 99] };
    const yrs = Math.max(0, Math.round(clamp(rng.normal(4, 3), 0, 15)));
    const inches = Math.round(rng.normal((rg.ht[0] + rg.ht[1]) / 2, 1.4));
    const round =
      yrs === 0 ? 0 : rng.next() < 0.12 ? 0 : 1 + Math.floor(rng.next() * 7);
    const pickIn = round ? 1 + Math.floor(rng.next() * 32) : 0;
    const isDef = pos === "DEF";
    const teamName = teams.find((info) => info.abbr === team)?.name ?? team;
    players.push({
      id: String(pid++),
      name: isDef ? teamName : pname(),
      position: pos,
      team,
      jerseyNumber: isDef
        ? null
        : rg.jer[0] + Math.floor(rng.next() * (rg.jer[1] - rg.jer[0] + 1)),
      age: isDef
        ? null
        : clamp(21 + yrs + Math.round(rng.normal(0, 1)), 21, 39),
      heightIn: isDef ? null : clamp(inches, rg.ht[0] - 1, rg.ht[1] + 1),
      weightLb: isDef
        ? null
        : Math.round(rng.normal((rg.wt[0] + rg.wt[1]) / 2, 8) / 5) * 5,
      college: isDef ? null : rng.pick(COLLEGES),
      rookieYear: isDef ? null : SAMPLE.season - yrs,
      yearsExp: isDef ? null : yrs,
      draftYear: isDef ? null : SAMPLE.season - yrs,
      draftRound: isDef ? null : round,
      draftPick: isDef ? null : round ? (round - 1) * 32 + pickIn : 0,
      injuryStatus: null,
      practiceStatus: null,
      role,
      recv,
      mob,
      talent: clamp(rng.normal(1, 0.14), 0.66, 1.38),
      depth: 0,
      rookieNoGames: false,
    });
  };
  for (const team of teams) {
    const abbr = team.abbr;
    mk("QB", abbr, 1, 0, rng.next() ** 2);
    mk("QB", abbr, 0.25, 0, rng.next() ** 2);
    const r1 = clamp(rng.normal(0.8, 0.1), 0.55, 1);
    mk("RB", abbr, r1, clamp(rng.normal(0.9, 0.3), 0.3, 1.6));
    mk(
      "RB",
      abbr,
      clamp(1 - r1 + rng.normal(0, 0.08), 0.25, 0.6),
      clamp(rng.normal(0.7, 0.3), 0.2, 1.4),
    );
    mk(
      "RB",
      abbr,
      clamp(rng.normal(0.28, 0.08), 0.12, 0.45),
      clamp(rng.normal(0.6, 0.3), 0.2, 1.2),
    );
    for (const role of [0.9, 0.7, 0.52, 0.34, 0.22]) {
      mk("WR", abbr, clamp(role + rng.normal(0, 0.07), 0.15, 1));
    }
    mk("TE", abbr, clamp(rng.normal(0.74, 0.14), 0.4, 1));
    mk("TE", abbr, clamp(rng.normal(0.34, 0.1), 0.15, 0.55));
    mk("K", abbr, 1);
    mk("DEF", abbr, 1);
    mk("DB", abbr, clamp(rng.normal(1, 0.12), 0.7, 1.3));
    mk("DB", abbr, clamp(rng.normal(0.85, 0.12), 0.6, 1.15));
    mk("LB", abbr, clamp(rng.normal(1, 0.12), 0.7, 1.35));
    mk("LB", abbr, clamp(rng.normal(0.82, 0.12), 0.6, 1.1));
    mk("DL", abbr, clamp(rng.normal(1, 0.14), 0.65, 1.4));
    mk("DL", abbr, clamp(rng.normal(0.8, 0.12), 0.55, 1.1));
  }
  // depth slot per team+position (1 = starter), by role then talent
  for (const team of teams) {
    const byPos = new Map<string, SamplePlayer[]>();
    for (const player of players) {
      if (player.team !== team.abbr) continue;
      const arr = byPos.get(player.position) ?? [];
      arr.push(player);
      byPos.set(player.position, arr);
    }
    for (const arr of byPos.values()) {
      arr
        .sort(
          (abbr, other) =>
            other.role * 2 + other.talent - (abbr.role * 2 + abbr.talent),
        )
        .forEach((player, index) => {
          player.depth = index + 1;
        });
    }
  }
  // current-season edge cases (prototype): a just-signed rookie, an IR star
  const rookie = players.find(
    (player) =>
      player.position === "WR" && player.yearsExp === 0 && player.depth >= 3,
  );
  if (rookie) {
    rookie.rookieNoGames = true;
    rookie.practiceStatus = "Full";
  }
  const star = players.find(
    (player) =>
      player.position === "RB" && player.depth === 1 && player.talent > 1.1,
  );
  if (star) {
    star.injuryStatus = "IR";
    star.practiceStatus = "Did not practice";
  }
  identityMemo = { teams, abbrs, players };
  return identityMemo;
}

/* ------------------------------------------------------------------ lines */

/** Raw per-position stats for one game; only the position's keys are present.
 * Shorthand follows the prototype: att/cmp/pyd/ptd/int = passing attempts,
 * completions, yards, TDs, interceptions · car/ryd/rtd = carries, rush yards,
 * rush TDs · tg/rec/cyd/ctd = targets, receptions, rec yards, rec TDs ·
 * fg/fg50/xp/miss = kicking · pa/ya = points/yards allowed · solo/ast/tfl/qbh/
 * pd/ff/fr = tackle and impact stats · snap/tgtsh/aysh/wopr = usage. */
type RawLine = Partial<Record<string, number>>;

/** One game's raw per-position stats (prototype genLine, verbatim math). */
function genLine(
  rng: Rng,
  player: SamplePlayer,
  offFactor: number,
  defFactor: number,
  talentFactor: number,
): RawLine {
  switch (player.position) {
    case "QB": {
      const att = Math.max(16, Math.round(rng.normal(33 * offFactor, 5)));
      const cmp = Math.round(
        att *
          clamp(rng.normal(0.65 * Math.sqrt(talentFactor), 0.06), 0.45, 0.8),
      );
      const pyd = Math.max(
        40,
        Math.round(
          att * clamp(rng.normal(7.1 * talentFactor * defFactor, 1.3), 4, 11),
        ),
      );
      const ptd = rng.pois(1.55 * talentFactor * defFactor * offFactor);
      const int = rng.pois(0.8 / talentFactor);
      const car = rng.pois(2 + player.mob * 6);
      const ryd = Math.max(-4, Math.round(car * rng.normal(4.5, 2)));
      const rtd = rng.pois(0.04 + player.mob * 0.3);
      const fum = rng.pois(0.12);
      const fd = rng.binom(att, 0.33) + rng.binom(car, 0.3);
      const snap = clamp(Math.round(rng.normal(99, 1.4)), 90, 100);
      const sk = rng.pois(2.1);
      const skyd = sk * Math.max(3, Math.round(rng.normal(6.5, 2)));
      const fuml = rng.binom(fum, 0.5);
      return {
        att,
        cmp,
        pyd,
        ptd,
        int,
        car,
        ryd,
        rtd,
        fum,
        fd,
        snap,
        sk,
        skyd,
        fuml,
      };
    }
    case "RB": {
      const car = rng.pois(18 * player.role * offFactor);
      const ryd = Math.round(
        car * clamp(rng.normal(4.3 * talentFactor * defFactor, 1), 1, 9),
      );
      const rtd = rng.pois(
        0.55 * player.role * talentFactor * defFactor * offFactor,
      );
      const tg = rng.pois(4.2 * player.role * player.recv);
      const rec = rng.binom(tg, 0.78);
      const cyd = Math.round(rec * clamp(rng.normal(7.5, 2.5), 2, 20));
      const ctd = rng.pois(0.08 * player.role * player.recv);
      const fum = rng.pois(0.08);
      const snap = clamp(
        Math.round(rng.normal(26 + 58 * player.role, 8)),
        5,
        100,
      );
      const tgtsh = clamp(
        rng.normal(0.04 + 0.09 * player.recv * player.role, 0.02),
        0,
        0.3,
      );
      const aysh = clamp(tgtsh * rng.normal(0.5, 0.12), 0, 0.2);
      const wopr = Math.round((1.5 * tgtsh + 0.7 * aysh) * 100) / 100;
      const fd = rng.binom(car, 0.22) + rng.binom(rec, 0.4);
      const fuml = rng.binom(fum, 0.5);
      return {
        car,
        ryd,
        rtd,
        tg,
        rec,
        cyd,
        ctd,
        fum,
        snap,
        tgtsh,
        aysh,
        wopr,
        fd,
        fuml,
      };
    }
    case "WR":
    case "TE": {
      const isWr = player.position === "WR";
      const tg = rng.pois((isWr ? 9 : 6.5) * player.role * offFactor);
      const rec = rng.binom(
        tg,
        isWr ? clamp(0.62 * Math.sqrt(talentFactor), 0.4, 0.8) : 0.7,
      );
      const cyd = Math.round(
        rec *
          clamp(
            rng.normal(
              (isWr ? 12.5 : 10.5) * talentFactor * defFactor,
              isWr ? 3 : 2.5,
            ),
            4,
            isWr ? 25 : 20,
          ),
      );
      const ctd = rng.pois(
        (isWr ? 0.5 : 0.38) *
          player.role *
          talentFactor *
          defFactor *
          offFactor,
      );
      const car = isWr && rng.next() < 0.08 ? 1 : 0;
      const ryd = car * Math.round(rng.normal(8, 4));
      const fum = rng.pois(0.04);
      const snap = clamp(
        Math.round(
          rng.normal(
            isWr ? 42 + 54 * player.role : 50 + 42 * player.role,
            isWr ? 7 : 8,
          ),
        ),
        isWr ? 10 : 15,
        100,
      );
      const tgtsh = clamp(
        rng.normal(0.12 + 0.16 * player.role, 0.03),
        0.02,
        0.42,
      );
      const aysh = clamp(
        tgtsh * rng.normal(1.12, 0.16) + (player.role > 0.6 ? 0.03 : 0),
        0.01,
        0.5,
      );
      const wopr = Math.round((1.5 * tgtsh + 0.7 * aysh) * 100) / 100;
      const fd = rng.binom(rec, 0.5) + ctd;
      const fuml = rng.binom(fum, 0.5);
      return {
        tg,
        rec,
        cyd,
        ctd,
        car,
        ryd,
        fum,
        snap,
        tgtsh,
        aysh,
        wopr,
        fd,
        fuml,
      };
    }
    case "K": {
      const fg = rng.pois(1.7 * offFactor * talentFactor);
      return {
        fg,
        fg50: rng.binom(fg, 0.2),
        xp: rng.pois(2.4 * offFactor),
        miss: rng.pois(0.3),
      };
    }
    case "DEF": {
      return {
        pa: Math.max(
          0,
          Math.round(rng.normal((22 / talentFactor) * defFactor, 8)),
        ),
        ya: Math.max(140, Math.round(rng.normal(330 / talentFactor, 55))),
        sk: rng.pois(2.4 * talentFactor),
        int: rng.pois(0.8 * talentFactor),
        fr: rng.pois(0.55),
        td: rng.pois(0.12 * talentFactor),
        saf: rng.next() < 0.03 ? 1 : 0,
      };
    }
    case "DB": {
      return {
        solo: rng.pois(4.2 * talentFactor),
        ast: rng.pois(1.8),
        sk: rng.pois(0.12 * talentFactor),
        int: rng.pois(0.18 * talentFactor),
        pd: rng.pois(1.0 * talentFactor),
        ff: rng.pois(0.08),
        fr: rng.pois(0.05),
        td: rng.next() < 0.01 ? 1 : 0,
        snap: clamp(Math.round(rng.normal(82, 10)), 40, 100),
      };
    }
    case "LB": {
      return {
        solo: rng.pois(5.6 * talentFactor),
        ast: rng.pois(3.0),
        sk: rng.pois(0.42 * talentFactor),
        int: rng.pois(0.09 * talentFactor),
        pd: rng.pois(0.5 * talentFactor),
        ff: rng.pois(0.11),
        fr: rng.pois(0.07),
        td: rng.next() < 0.01 ? 1 : 0,
        snap: clamp(Math.round(rng.normal(78, 12)), 35, 100),
      };
    }
    default: {
      return {
        solo: rng.pois(2.8 * talentFactor),
        ast: rng.pois(1.9),
        sk: rng.pois(0.62 * talentFactor),
        tfl: rng.pois(0.8 * talentFactor),
        qbh: rng.pois(1.1 * talentFactor),
        int: 0,
        pd: rng.pois(0.2),
        ff: rng.pois(0.1),
        fr: rng.pois(0.06),
        td: rng.next() < 0.005 ? 1 : 0,
        snap: clamp(Math.round(rng.normal(66, 13)), 25, 100),
      };
    }
  }
}

/** Raw line -> the contract's per-position StatLine (PE4). */
function toStatLine(
  player: SamplePlayer,
  raw: RawLine,
  week: number,
  team: string,
  opponent: string | null,
  home: boolean,
): StatLine {
  const base = {
    playerId: player.id,
    week,
    teamPlayedFor: team,
    opponent,
    home,
    snapPct: raw.snap ?? null,
  };
  switch (player.position) {
    case "QB":
      return {
        ...base,
        position: "QB",
        attempts: raw.att ?? 0,
        completions: raw.cmp ?? 0,
        passYards: raw.pyd ?? 0,
        passTds: raw.ptd ?? 0,
        interceptions: raw.int ?? 0,
        sacksTaken: raw.sk ?? 0,
        sackYards: raw.skyd ?? 0,
        carries: raw.car ?? 0,
        rushYards: raw.ryd ?? 0,
        rushTds: raw.rtd ?? 0,
        fumbles: raw.fum ?? 0,
        fumblesLost: raw.fuml ?? 0,
        firstDowns: raw.fd ?? 0,
      };
    case "RB":
      return {
        ...base,
        position: "RB",
        carries: raw.car ?? 0,
        rushYards: raw.ryd ?? 0,
        rushTds: raw.rtd ?? 0,
        targets: raw.tg ?? 0,
        receptions: raw.rec ?? 0,
        recYards: raw.cyd ?? 0,
        recTds: raw.ctd ?? 0,
        fumbles: raw.fum ?? 0,
        fumblesLost: raw.fuml ?? 0,
        firstDowns: raw.fd ?? 0,
        targetShare: raw.tgtsh ?? null,
        airYardsShare: raw.aysh ?? null,
        wopr: raw.wopr ?? null,
      };
    case "WR":
    case "TE":
      return {
        ...base,
        position: player.position,
        targets: raw.tg ?? 0,
        receptions: raw.rec ?? 0,
        recYards: raw.cyd ?? 0,
        recTds: raw.ctd ?? 0,
        carries: raw.car ?? 0,
        rushYards: raw.ryd ?? 0,
        fumbles: raw.fum ?? 0,
        fumblesLost: raw.fuml ?? 0,
        firstDowns: raw.fd ?? 0,
        targetShare: raw.tgtsh ?? null,
        airYardsShare: raw.aysh ?? null,
        wopr: raw.wopr ?? null,
      };
    case "K":
      return {
        ...base,
        position: "K",
        fgMade: raw.fg ?? 0,
        fgMissed: raw.miss ?? 0,
        fg50Plus: raw.fg50 ?? 0,
        xpMade: raw.xp ?? 0,
      };
    case "DEF":
      return {
        ...base,
        position: "DEF",
        pointsAllowed: raw.pa ?? 0,
        yardsAllowed: raw.ya ?? 0,
        sacks: raw.sk ?? 0,
        interceptions: raw.int ?? 0,
        fumbleRecoveries: raw.fr ?? 0,
        tds: raw.td ?? 0,
        safeties: raw.saf ?? 0,
      };
    default:
      return {
        ...base,
        position: player.position,
        soloTackles: raw.solo ?? 0,
        assistTackles: raw.ast ?? 0,
        sacks: raw.sk ?? 0,
        tacklesForLoss: raw.tfl ?? 0,
        interceptions: raw.int ?? 0,
        passesDefended: raw.pd ?? 0,
        forcedFumbles: raw.ff ?? 0,
        fumbleRecoveries: raw.fr ?? 0,
        qbHits: raw.qbh ?? 0,
        tds: raw.td ?? 0,
      };
  }
}

/* ---------------------------------------------------------------- seasons */

const DAY_SLOTS: [number, number, number][] = [
  // [day offset from the week's Thursday, hourET, minute]
  [0, 20, 15],
  [3, 13, 0],
  [3, 13, 0],
  [3, 13, 0],
  [3, 16, 5],
  [3, 16, 25],
  [3, 20, 20],
  [4, 20, 15],
];

/** Week 1's Thursday for a season (first Thursday of September, roughly). */
function weekOneThursday(season: number): number {
  // Deterministic approximation: Sep 7 of the season year, 00:00 UTC.
  return Date.UTC(season, 8, 7);
}

function kickoffIso(season: number, week: number, slot: number): string {
  const [dayOffset, hourEt, minute] = DAY_SLOTS[slot % DAY_SLOTS.length] ?? [
    3, 13, 0,
  ];
  const instant =
    weekOneThursday(season) +
    ((week - 1) * 7 + dayOffset) * 86400000 +
    (hourEt + 5) * 3600000 + // ET -> UTC (EST offset; sample precision is fine)
    minute * 60000;
  return new Date(instant).toISOString();
}

function footballScore(r: Rng, str: number): number {
  const pts = clamp(Math.round(r.normal(22 + (str - 1) * 16, 9)), 3, 45);
  // prettier-ignore
  const near = [0,3,6,7,10,13,14,16,17,20,21,23,24,27,28,30,31,34,35,37,38,41,42,44,45];
  // snap the raw number to the closest plausible football total
  return near.reduce((closest, candidate) =>
    Math.abs(candidate - pts) < Math.abs(closest - pts) ? candidate : closest,
  );
}

const seasonMemo = new Map<number, SeasonData>();

/** Builds one full season deterministically (seeded by year). */
export function buildSeason(season: number): SeasonData {
  const memo = seasonMemo.get(season);
  if (memo) return memo;
  const { teams, abbrs, players } = identity();
  const isCurrent = season === SAMPLE.season;
  const lg = new Rng(hash2(season, 77));

  // byes: 4 teams per week over weeks 5..14 (prototype distribution)
  // byes: roughly 3–4 teams per week across weeks 5–14, like the NFL
  const byePool = lg.shuffle(
    [5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
      .flatMap((week) => [week, week, week])
      .concat([6, 7, 8, 9]),
  );
  const bye = new Map<string, number>();
  abbrs.forEach((abbr, index) => bye.set(abbr, byePool[index] ?? 7));

  // opponents per week
  const opp = new Map<number, Map<string, string | null>>();
  for (let week = 1; week <= SAMPLE.seasonWeeks; week++) {
    const map = new Map<string, string | null>();
    for (const abbr of abbrs) map.set(abbr, null);
    // pair off every non-bye team randomly for the week's slate
    const act = lg.shuffle(abbrs.filter((abbr) => bye.get(abbr) !== week));
    for (let index = 0; index + 1 < act.length; index += 2) {
      map.set(act[index], act[index + 1]);
      map.set(act[index + 1], act[index]);
    }
    opp.set(week, map);
  }

  // season strengths
  // per-season team strengths make stats and scores non-uniform
  const off = new Map<string, number>();
  const defq = new Map<string, Map<string, number>>();
  for (const abbr of abbrs) {
    off.set(abbr, clamp(lg.normal(1, 0.09), 0.8, 1.2));
    const map = new Map<string, number>();
    for (const pos of ["QB", "RB", "WR", "TE", "K", "DEF", "DB", "DL", "LB"]) {
      map.set(pos, clamp(lg.normal(1, 0.1), 0.78, 1.22));
    }
    defq.set(abbr, map);
  }

  // schedule
  const games: Game[] = [];
  const teamByAbbr = new Map(teams.map((team) => [team.abbr, team]));
  const starterQb = (abbr: string) =>
    players.find(
      (player) =>
        player.team === abbr && player.position === "QB" && player.depth === 1,
    )?.name ?? null;
  for (let week = 1; week <= SAMPLE.seasonWeeks; week++) {
    const played = isCurrent ? week <= SAMPLE.playedWeeks : true;
    const seen = new Set<string>();
    let slot = 0;
    for (const abbr of abbrs) {
      const opponent = opp.get(week)?.get(abbr);
      if (!opponent || seen.has(abbr) || seen.has(opponent)) continue;
      seen.add(abbr);
      seen.add(opponent);
      const home =
        // deterministic home pick: lower league index hosts
        abbrs.indexOf(abbr) < abbrs.indexOf(opponent) ? abbr : opponent;
      const away = home === abbr ? opponent : abbr;
      const ht = teamByAbbr.get(home);
      const dome = ht?.roof === "dome";
      const retracClosed = ht?.roof === "retractable" && lg.next() < 0.5;
      const spread =
        Math.round(
          lg.normal(
            ((off.get(home) ?? 1) * 1.03 - (off.get(away) ?? 1)) * 20,
            1,
          ) * 2,
        ) / 2;
      const homeScore = played
        ? footballScore(lg, (off.get(home) ?? 1) / (off.get(away) ?? 1))
        : null;
      let awayScore = played
        ? footballScore(lg, (off.get(away) ?? 1) / (off.get(home) ?? 1))
        : null;
      if (played && homeScore === awayScore && awayScore != null)
        awayScore = awayScore - 3;
      games.push({
        id: `${String(season)}-${String(week)}-${away}-${home}`,
        season,
        phase: "REG",
        week: week,
        kickoff: kickoffIso(season, week, slot),
        homeTeam: home,
        awayTeam: away,
        homeScore,
        awayScore,
        overtime:
          played && homeScore != null && awayScore != null
            ? Math.abs(homeScore - awayScore) <= 3 && lg.next() < 0.22
            : false,
        final: played,
        stadium: ht?.stadium ?? null,
        roof: ht?.roof ?? null,
        surface: ht?.surface ?? null,
        temperatureF:
          dome || retracClosed ? null : Math.round(lg.normal(54, 16)),
        windMph:
          dome || retracClosed
            ? null
            : Math.max(0, Math.round(lg.normal(9, 5))),
        spreadLine: Math.abs(spread) || 1,
        totalLine: Math.round(clamp(lg.normal(44, 5), 33, 56) * 2) / 2,
        favorite: spread <= 0 ? home : away,
        homeQb: starterQb(home),
        awayQb: starterQb(away),
        homeCoach: ht?.headCoach ?? null,
        awayCoach: teamByAbbr.get(away)?.headCoach ?? null,
        homeRestDays: lg.next() < 0.08 ? 4 : lg.next() < 0.1 ? 10 : 7,
        awayRestDays: lg.next() < 0.08 ? 4 : lg.next() < 0.1 ? 10 : 7,
        divisionGame:
          teamByAbbr.get(home)?.division === teamByAbbr.get(away)?.division,
      });
      slot++;
    }
  }

  // per-player weekly lines
  const lines: StatLine[] = [];
  const seasonPlayers: Player[] = [];
  const lastWeek = isCurrent ? SAMPLE.playedWeeks : SAMPLE.seasonWeeks;
  for (const player of players) {
    const entry = player.rookieYear ?? SAMPLE.firstSeason;
    if (player.position !== "DEF" && entry > season) continue; // not in the league yet
    const pr = new Rng(hash2(Number(player.id) + 1, season));

    // team that season (free agency drifts in prior seasons), mid-season trade
    const yearsBack = SAMPLE.season - season;
    let baseTeam = player.team ?? "ARI";
    if (
      !isCurrent &&
      player.position !== "DEF" &&
      yearsBack >= 1 &&
      // free agency: the further back the season, the likelier a different team
      pr.next() < 0.18 * yearsBack
    ) {
      baseTeam = pr.pick(abbrs);
    }
    let tradeWeek: number | null = null;
    let tradeTeam: string | null = null;
    // ~10% of prior seasons include a mid-season trade
    if (!isCurrent && player.position !== "DEF" && pr.next() < 0.1) {
      tradeWeek = 5 + Math.floor(pr.next() * 9);
      tradeTeam = pr.pick(abbrs.filter((team) => team !== baseTeam));
    }

    // missed weeks (injury); current season also sets the live status
    const miss = new Set<number>();
    let status: string | null = null;
    let practice: string | null = null;
    if (player.position !== "DEF" && pr.next() < (isCurrent ? 0.16 : 0.22)) {
      const st = 1 + Math.floor(pr.next() * (isCurrent ? 9 : 14));
      const len = 1 + Math.floor(pr.next() * (isCurrent ? 3 : 4));
      for (let week = st; week < st + len; week++) miss.add(week);
      if (isCurrent) {
        if (miss.has(SAMPLE.currentWeek)) {
          status = len >= 3 ? "IR" : "O";
          practice = "Did not practice";
        } else if (miss.has(SAMPLE.currentWeek - 1)) {
          status = "Q";
          practice = pr.next() < 0.5 ? "Limited" : "Full";
        }
      }
    }
    if (isCurrent && !status && player.position !== "DEF" && pr.next() < 0.07) {
      status = "Q";
      practice = pr.pick(["Full", "Limited", "Did not practice"]);
    }

    // aging drift for prior seasons
    const ageNow = player.age ?? 27;
    const aging = (age: number) => {
      const fromPeak = age - 26;
      return clamp(
        1 - 0.012 * Math.abs(fromPeak) - (fromPeak > 0 ? 0.006 * fromPeak : 0),
        0.7,
        1.05,
      );
    };
    // prior-season talent drifts with the age curve (peak ≈ 26)
    const talent = isCurrent
      ? player.talent
      : clamp(
          ((player.talent * aging(ageNow - yearsBack)) / aging(ageNow)) *
            pr.normal(1, 0.05),
          0.5,
          1.6,
        );

    const isRookieNoGames = isCurrent && player.rookieNoGames;
    const isIrStar = isCurrent && player.injuryStatus === "IR";
    for (let week = 1; week <= lastWeek; week++) {
      const team =
        tradeWeek && tradeTeam && week >= tradeWeek
          ? tradeTeam
          : isCurrent
            ? (player.team ?? baseTeam)
            : baseTeam;
      const opponent = opp.get(week)?.get(team) ?? null;
      if (opponent === null) continue; // bye — abbr gap, not abbr zero
      if (miss.has(week)) continue; // missed — abbr gap
      if (isRookieNoGames) continue;
      if (isIrStar && week >= 4) continue;
      const raw = genLine(
        pr,
        player,
        off.get(team) ?? 1,
        defq.get(opponent)?.get(player.position) ?? 1,
        talent,
      );
      const game = games.find(
        (game) =>
          game.week === week &&
          (game.homeTeam === team || game.awayTeam === team),
      );
      lines.push(
        toStatLine(
          player,
          raw,
          week,
          team,
          opponent,
          game ? game.homeTeam === team : true,
        ),
      );
    }

    seasonPlayers.push({
      ...playerPublic(player),
      injuryStatus: isCurrent ? (player.injuryStatus ?? status) : null,
      practiceStatus: isCurrent ? (player.practiceStatus ?? practice) : null,
      team: isCurrent ? player.team : baseTeam,
    });
  }

  const data: SeasonData = {
    season,
    players: seasonPlayers,
    teams: teams.map((team) => ({ ...team, byeWeek: bye.get(team.abbr) ?? 7 })),
    statLines: lines,
    games,
  };
  seasonMemo.set(season, data);
  return data;
}

/** Strips generator-internal knobs off a SamplePlayer. */
function playerPublic(player: SamplePlayer): Player {
  const {
    role: _r,
    recv: _v,
    mob: _m,
    talent: _t,
    depth: _d,
    rookieNoGames: _g,
    ...pub
  } = player;
  return pub;
}
