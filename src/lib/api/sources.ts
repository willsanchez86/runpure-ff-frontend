/** The data-source switch (foundation spec §6.4, P6): sample (prototype port)
 * or api (GraphQL). Screens never import a source directly — only the hooks. */
import type { DataSource, Freshness, Me, SeasonData } from "./contract";
import { gqlRequest } from "./gql";
import { MeDocument } from "../../../generated/graphql";
import { buildSeason, SAMPLE } from "@/lib/sample/world";

/** Sample mode: deterministic generated data, no network, instant "me".
 * Freshness reports "the most recent 06:00 ET daily run" relative to the real
 * clock so the note reads sensibly and the stale state stays reachable. */
export const sampleSource: DataSource = {
  me: () => Promise.resolve({ id: "sample", isOperator: false }),
  seasonData: (season: number) => Promise.resolve(buildSeason(season)),
  freshness: () => {
    const now = new Date();
    const run = new Date(now);
    run.setUTCHours(11, 0, 0, 0); // 06:00 ET ≈ 11:00 UTC
    if (run.getTime() > now.getTime()) run.setUTCDate(run.getUTCDate() - 1);
    const iso = run.toISOString();
    return Promise.resolve<Freshness>({
      playersLoadedAt: iso,
      statsLoadedAt: iso,
      gamesLoadedAt: iso,
    });
  },
};

/** API mode: `me` is live now; the season/freshness fields land at contract
 * cut-over (foundation spec §13 step 7) and replace these explicit errors. */
export const apiSource: DataSource = {
  me: async () => {
    const data = await gqlRequest(MeDocument, undefined);
    return (data.me as Me | null | undefined) ?? null;
  },
  seasonData: (season: number): Promise<SeasonData> =>
    Promise.reject(
      new Error(
        `The players/teams/statLines/games fields for season ${String(season)} are not in the backend schema yet (contract cut-over, foundation spec step 7).`,
      ),
    ),
  freshness: (): Promise<Freshness> =>
    Promise.reject(
      new Error("dataFreshness is not in the backend schema yet."),
    ),
};

/** The active source, fixed at build time by NEXT_PUBLIC_DATA_SOURCE. */
export const dataSource: DataSource =
  process.env.NEXT_PUBLIC_DATA_SOURCE === "api" ? apiSource : sampleSource;

/** True when the build runs on generated sample data. */
export const IS_SAMPLE_MODE = process.env.NEXT_PUBLIC_DATA_SOURCE !== "api";

/** The app's current season. Sample mode pins the prototype's clock; api mode
 * is refined at contract cut-over (the ETL's D6 season-switch dates are
 * server truth). */
export const CURRENT_SEASON: number = SAMPLE.season;

/** Seasons the card/list can open: 2022 → current (ADR-0006; PE2/PE3). */
export const SEASONS: number[] = Array.from(
  { length: SAMPLE.season - SAMPLE.firstSeason + 1 },
  (_, i) => SAMPLE.firstSeason + i,
);
