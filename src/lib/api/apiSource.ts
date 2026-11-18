/** The live GraphQL data source (contract cut-over, foundation spec §13 step 7).
 * Fans the season queries out, pages statLines to exhaustion (5,000-row pages,
 * player spec PE4) and reshapes the per-position union into the contract types.
 * Logs the measured payload size — the PE4 risk item — on every season fetch. */
import type {
  DataSource,
  Freshness,
  Me,
  Player,
  Position,
  SeasonData,
  StatLine,
} from "./contract";
import { gqlRequest } from "./gql";
import {
  FreshnessDocument,
  GamesDocument,
  MeDocument,
  PlayersDocument,
  StatLinesDocument,
  TeamsDocument,
  type StatLinesQuery,
} from "../../../generated/graphql";

type GqlStatItem = NonNullable<
  NonNullable<StatLinesQuery["statLines"]>["items"]
>[number];

const STAT_PAGE_LIMIT = 5000;

/** WR vs TE (and DB/LB/DL) come from the player row; the union type alone
 * can't distinguish them (WrTeStatLine / IdpStatLine are shared shapes). */
function lineFromItem(
  item: GqlStatItem,
  positionOf: Map<string, Position>,
): StatLine | null {
  const base = {
    playerId: item.playerId,
    week: item.week,
    teamPlayedFor: item.teamPlayedFor,
    opponent: item.opponent ?? null,
    home: item.home,
    snapPct: item.snapPct ?? null,
  };
  const num = (value: number | null | undefined): number => value ?? 0;
  switch (item.__typename) {
    case "QbStatLine":
      return {
        ...base,
        position: "QB",
        attempts: num(item.attempts),
        completions: num(item.completions),
        passYards: num(item.passYards),
        passTds: num(item.passTds),
        interceptions: num(item.interceptions),
        sacksTaken: num(item.sacksTaken),
        sackYards: num(item.sackYards),
        carries: num(item.carries),
        rushYards: num(item.rushYards),
        rushTds: num(item.rushTds),
        fumbles: num(item.fumbles),
        fumblesLost: num(item.fumblesLost),
        firstDowns: num(item.firstDowns),
      };
    case "RbStatLine":
      return {
        ...base,
        position: "RB",
        carries: num(item.carries),
        rushYards: num(item.rushYards),
        rushTds: num(item.rushTds),
        targets: num(item.targets),
        receptions: num(item.receptions),
        recYards: num(item.recYards),
        recTds: num(item.recTds),
        fumbles: num(item.fumbles),
        fumblesLost: num(item.fumblesLost),
        firstDowns: num(item.firstDowns),
        targetShare: item.targetShare ?? null,
        airYardsShare: item.airYardsShare ?? null,
        wopr: item.wopr ?? null,
      };
    case "WrTeStatLine": {
      const position = positionOf.get(item.playerId);
      return {
        ...base,
        position: position === "TE" ? "TE" : "WR",
        targets: num(item.targets),
        receptions: num(item.receptions),
        recYards: num(item.recYards),
        recTds: num(item.recTds),
        carries: num(item.carries),
        rushYards: num(item.rushYards),
        fumbles: num(item.fumbles),
        fumblesLost: num(item.fumblesLost),
        firstDowns: num(item.firstDowns),
        targetShare: item.targetShare ?? null,
        airYardsShare: item.airYardsShare ?? null,
        wopr: item.wopr ?? null,
      };
    }
    case "KStatLine":
      return {
        ...base,
        position: "K",
        fgMade: num(item.fgMade),
        fgMissed: num(item.fgMissed),
        fg50Plus: num(item.fg50Plus),
        xpMade: num(item.xpMade),
      };
    case "DefStatLine":
      return {
        ...base,
        position: "DEF",
        pointsAllowed: num(item.pointsAllowed),
        yardsAllowed: num(item.yardsAllowed),
        sacks: num(item.sacks),
        interceptions: num(item.interceptions),
        fumbleRecoveries: num(item.fumbleRecoveries),
        tds: num(item.tds),
        safeties: num(item.safeties),
      };
    case "IdpStatLine": {
      const position = positionOf.get(item.playerId);
      return {
        ...base,
        position: position === "LB" || position === "DL" ? position : "DB",
        soloTackles: num(item.soloTackles),
        assistTackles: num(item.assistTackles),
        sacks: num(item.sacks),
        tacklesForLoss: num(item.tacklesForLoss),
        interceptions: num(item.interceptions),
        passesDefended: num(item.passesDefended),
        forcedFumbles: num(item.forcedFumbles),
        fumbleRecoveries: num(item.fumbleRecoveries),
        qbHits: num(item.qbHits),
        tds: num(item.tds),
      };
    }
    default:
      return null;
  }
}

/** Fetches one season: three fan-out queries + statLines paged to exhaustion. */
async function fetchSeason(season: number): Promise<SeasonData> {
  const [playersData, teamsData, gamesData] = await Promise.all([
    gqlRequest(PlayersDocument, { season }),
    gqlRequest(TeamsDocument, { season }),
    gqlRequest(GamesDocument, { season }),
  ]);
  const players: Player[] = playersData.players.map((row) => ({
    ...row,
    position: row.position as Position,
    team: row.team ?? null,
    jerseyNumber: row.jerseyNumber ?? null,
    age: row.age ?? null,
    heightIn: row.heightIn ?? null,
    weightLb: row.weightLb ?? null,
    college: row.college ?? null,
    rookieYear: row.rookieYear ?? null,
    yearsExp: row.yearsExp ?? null,
    draftYear: row.draftYear ?? null,
    draftRound: row.draftRound ?? null,
    draftPick: row.draftPick ?? null,
    injuryStatus: row.injuryStatus ?? null,
    practiceStatus: row.practiceStatus ?? null,
  }));
  const positionOf = new Map(
    players.map((player) => [player.id, player.position]),
  );

  // page statLines to exhaustion (keyset cursor; DEF lines ride the last page)
  const statLines: StatLine[] = [];
  let after: string | null = null;
  let pages = 0;
  let itemCount = 0;
  do {
    const page: StatLinesQuery = await gqlRequest(StatLinesDocument, {
      season,
      after,
      limit: STAT_PAGE_LIMIT,
    });
    const items = page.statLines.items;
    itemCount += items.length;
    for (const item of items) {
      const line = lineFromItem(item, positionOf);
      if (line) statLines.push(line);
    }
    after = page.statLines.nextCursor ?? null;
    pages++;
  } while (after);

  const data: SeasonData = {
    season,
    players,
    teams: teamsData.teams.map((team) => ({
      ...team,
      stadium: team.stadium ?? null,
      roof: team.roof ?? null,
      surface: team.surface ?? null,
      headCoach: team.headCoach ?? null,
      byeWeek: team.byeWeek ?? 0,
    })),
    statLines,
    games: gamesData.games.map((game) => ({
      ...game,
      phase: game.phase as "PRE" | "REG" | "POST",
      homeScore: game.homeScore ?? null,
      awayScore: game.awayScore ?? null,
      stadium: game.stadium ?? null,
      roof: game.roof ?? null,
      surface: game.surface ?? null,
      temperatureF: game.temperatureF ?? null,
      windMph: game.windMph ?? null,
      spreadLine: game.spreadLine ?? null,
      totalLine: game.totalLine ?? null,
      favorite: game.favorite ?? null,
      homeQb: game.homeQb ?? null,
      awayQb: game.awayQb ?? null,
      homeCoach: game.homeCoach ?? null,
      awayCoach: game.awayCoach ?? null,
      homeRestDays: game.homeRestDays ?? null,
      awayRestDays: game.awayRestDays ?? null,
    })),
  };

  // PE4 measurement: the payload-size risk item, recorded on every fetch
  const bytes = new TextEncoder().encode(JSON.stringify(data)).length;
  console.info(
    `[payload] season ${String(season)}: ${String(players.length)} players, ` +
      `${String(itemCount)} stat lines over ${String(pages)} page(s), ` +
      `${String(data.games.length)} games — ~${(bytes / 1_048_576).toFixed(2)} MB`,
  );
  return data;
}

/** The live source: GraphQL over the hand-written request layer (ADR-0019). */
export const liveApiSource: DataSource = {
  me: async () => {
    const data = await gqlRequest(MeDocument, undefined);
    return (data.me as Me | null | undefined) ?? null;
  },
  seasonData: fetchSeason,
  freshness: async (): Promise<Freshness> => {
    const data = await gqlRequest(FreshnessDocument, undefined);
    return {
      playersLoadedAt: data.dataFreshness.playersLoadedAt ?? null,
      statsLoadedAt: data.dataFreshness.statsLoadedAt ?? null,
      gamesLoadedAt: data.dataFreshness.gamesLoadedAt ?? null,
    };
  },
};
