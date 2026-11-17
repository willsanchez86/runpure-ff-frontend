/** List filtering + sorting (player spec §3, §4.3). Pure functions over the
 * derived model so they are unit-testable without React. */
import type { Player } from "@/lib/api/contract";
import type { PlayerRangeStats, SeasonModel } from "@/lib/scoring/types";
import type { PosFilter, Settings } from "@/lib/settings/model";

/** A list row: the player plus everything sorting/rendering needs. */
export interface Row {
  player: Player;
  stats: PlayerRangeStats;
}

// case- and accent-insensitive search key (PRD must-have)
const fold = (text: string): string =>
  text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** True when the player passes the position pill/filter. */
export function matchesPosition(pos: PosFilter, player: Player): boolean {
  switch (pos) {
    case "ALL":
      return true;
    case "FLEX":
      return ["RB", "WR", "TE"].includes(player.position);
    case "IDP":
      return ["DB", "LB", "DL"].includes(player.position);
    default:
      return player.position === pos;
  }
}

/** Applies every list filter (they combine; PRD must-have). */
export function filterRows(
  rows: Row[],
  settings: Settings,
  model: SeasonModel,
): Row[] {
  const query = fold(settings.query.trim());
  return rows.filter(({ player, stats }) => {
    if (!matchesPosition(settings.posFilter, player)) return false;
    if (settings.teamFilter !== "ALL" && player.team !== settings.teamFilter)
      return false;
    if (settings.injFilter !== "ALL") {
      if (settings.injFilter === "HEALTHY") {
        if (player.injuryStatus != null) return false;
      } else if (player.injuryStatus !== settings.injFilter) return false;
    }
    if (settings.byeFilter !== "ALL") {
      const bye = player.team
        ? model.teamsByAbbr.get(player.team)?.byeWeek
        : null;
      if (bye !== settings.byeFilter) return false;
    }
    if (stats.gp < settings.minGp) return false;
    if (settings.rookieOnly && player.rookieYear !== model.season) return false;
    if (query) {
      const nameHit = fold(player.name).includes(query);
      const teamHit = (player.team ?? "").toLowerCase() === query;
      if (!nameHit && !teamHit) return false;
    }
    return true;
  });
}

/** Sorts in place by the active column's value; nulls last; ties by name
 * (PRD must-have). `get` maps a row to its sortable value. */
export function sortRows(
  rows: Row[],
  get: (row: Row) => number | null,
  dir: 1 | -1,
): Row[] {
  return rows.sort((rowA, rowB) => {
    const valueA = get(rowA);
    const valueB = get(rowB);
    if (valueA == null && valueB == null) {
      return rowA.player.name.localeCompare(rowB.player.name);
    }
    if (valueA == null) return 1;
    if (valueB == null) return -1;
    if (valueA !== valueB) return (valueA - valueB) * dir;
    return rowA.player.name.localeCompare(rowB.player.name);
  });
}
