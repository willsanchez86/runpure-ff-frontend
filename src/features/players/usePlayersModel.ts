/** Derived-model hook (foundation spec §2.1): season data + scoring config →
 * memoized SeasonModel and per-player range stats. Derived numbers are never
 * stored — recomputed (memoized) when data, scoring or range change. */
"use client";

import { useMemo } from "react";
import { useSeasonData } from "@/lib/api/hooks";
import { CURRENT_SEASON } from "@/lib/api/sources";
import { buildSeasonModel, playerRangeStats } from "@/lib/scoring/engine";
import type { RangeConfig, SeasonModel } from "@/lib/scoring/types";
import { useSettings } from "@/lib/settings/SettingsProvider";
import type { Row } from "./filtering";

/** One season's derived model under the active scoring config (used by the
 * card's season pills and the list; cached per season by TanStack Query). */
export function useSeasonModel(season: number): {
  model: SeasonModel | null;
  isLoading: boolean;
  error: Error | null;
} {
  const { settings } = useSettings();
  const query = useSeasonData(season);
  const model = useMemo(() => {
    if (!query.data) return null;
    return buildSeasonModel(
      query.data,
      { fmt: settings.fmt, tePrem: settings.tePrem, ptd6: settings.ptd6 },
      CURRENT_SEASON,
    );
  }, [query.data, settings.fmt, settings.tePrem, settings.ptd6]);
  return {
    model,
    isLoading: query.isLoading,
    error: query.isError ? query.error : null,
  };
}

/** The players screen's data: model + rows, with loading/error passthrough. */
export function usePlayersModel(season: number): {
  model: SeasonModel | null;
  rows: Row[];
  range: RangeConfig;
  isLoading: boolean;
  error: Error | null;
  retry: () => void;
} {
  const { settings } = useSettings();
  const query = useSeasonData(season);

  const model = useMemo(() => {
    if (!query.data) return null;
    return buildSeasonModel(
      query.data,
      { fmt: settings.fmt, tePrem: settings.tePrem, ptd6: settings.ptd6 },
      CURRENT_SEASON,
    );
  }, [query.data, settings.fmt, settings.tePrem, settings.ptd6]);

  // the active stat window: full season or custom weeks (cwkFrom–cwkTo),
  // with counting stats shown per game when toggled
  const range: RangeConfig = useMemo(
    () => ({
      kind: settings.range,
      from: settings.cwkFrom,
      to: settings.cwkTo,
      perGame: settings.perGame,
    }),
    [settings.range, settings.cwkFrom, settings.cwkTo, settings.perGame],
  );

  const rows = useMemo(() => {
    if (!model) return [];
    return model.players.map((player) => ({
      player,
      stats: playerRangeStats(model, player.id, range),
    }));
  }, [model, range]);

  return {
    model,
    rows,
    range,
    isLoading: query.isLoading,
    error: query.isError ? query.error : null,
    retry: () => {
      void query.refetch();
    },
  };
}
