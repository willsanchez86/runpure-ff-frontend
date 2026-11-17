/** Screen-facing data hooks (foundation spec §6.3): TanStack Query over the
 * active DataSource. One fetch per season per session; staleness comes from
 * the freshness field, never cache age (ADR-0019). */
"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { Freshness, Me, SeasonData } from "./contract";
import { dataSource } from "./sources";

/** The signed-in app account; null = signed into Firebase but no account row. */
export function useMe(): UseQueryResult<Me | null> {
  return useQuery({ queryKey: ["me"], queryFn: () => dataSource.me() });
}

/** One season's players, teams, stat lines and games (player spec §9.3:
 * fetched once per session, whichever surface asks first). */
export function useSeasonData(season: number): UseQueryResult<SeasonData> {
  return useQuery({
    queryKey: ["season", season],
    queryFn: () => dataSource.seasonData(season),
  });
}

/** When each dataset last loaded — drives the shell's freshness note. */
export function useFreshness(): UseQueryResult<Freshness> {
  return useQuery({
    queryKey: ["freshness"],
    queryFn: () => dataSource.freshness(),
  });
}
