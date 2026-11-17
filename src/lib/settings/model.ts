/** Settings model (foundation spec §8, decision F7): everything the Player
 * explorer persists per account. Pure: defaults + sanitizer; no storage here.
 * The sanitizer ports the prototype's load rules (unknown columns dropped,
 * legacy ranges migrated, invalid sort reset). */

/** Position filter values the list accepts. */
export type PosFilter =
  | "ALL"
  | "QB"
  | "RB"
  | "WR"
  | "TE"
  | "K"
  | "DEF"
  | "FLEX"
  | "IDP"
  | "DB"
  | "LB"
  | "DL";

/** The persisted settings document (one JSON blob server-side, spec §7). */
export interface Settings {
  /** Scoring format: full point, half point, or zero points per reception. */
  fmt: "ppr" | "half" | "std";
  /** Tight-end premium: +0.5 per TE reception. */
  tePrem: boolean;
  /** Six-point passing touchdowns (otherwise four). */
  ptd6: boolean;
  /** Compact table rows (30px instead of 38px). */
  compact: boolean;
  /** Range switch: the full season, or a custom span of weeks. */
  range: "season" | "custom";
  /** Show counting stats per game instead of as totals. */
  perGame: boolean;
  /** Custom-week range bounds (order-insensitive; clamped 1..18). */
  cwkFrom: number;
  cwkTo: number;
  /** Only players whose rookie year is the shown season. */
  rookieOnly: boolean;
  posFilter: PosFilter;
  /** "ALL" or a team abbreviation (e.g. "KC"). */
  teamFilter: string;
  /** Injury filter: Questionable / Out / Injured Reserve. */
  injFilter: "ALL" | "HEALTHY" | "Q" | "O" | "IR";
  /** "ALL" or a specific bye week number. */
  byeFilter: "ALL" | number;
  /** Minimum games played in range. */
  minGp: number;
  /** Search text (name partial or exact team code). */
  query: string;
  /** Visible columns, one set per position family (player spec 4.2). */
  cols: string[];
  colsK: string[];
  colsDEF: string[];
  colsIDP: string[];
  /** Active sort: [column key, 1 ascending | -1 descending]. */
  sort: [string, 1 | -1];
}

/** Which column-set key a position filter uses (player spec §4.2). */
export function colsKeyFor(
  pos: PosFilter,
): "cols" | "colsK" | "colsDEF" | "colsIDP" {
  if (pos === "K") return "colsK";
  if (pos === "DEF") return "colsDEF";
  if (pos === "IDP" || pos === "DB" || pos === "LB" || pos === "DL")
    return "colsIDP";
  return "cols";
}

/** Columns offered per set (player spec §4.1/§4.2; prototype colsOffered). */
export function colsOffered(
  key: "cols" | "colsK" | "colsDEF" | "colsIDP",
): string[] {
  if (key === "colsK") {
    return [
      "total",
      "avg",
      "high",
      "low",
      "sd",
      "gp",
      "rank",
      "tier",
      "k_fgm",
      "k_fga",
      "k_fgpct",
      "k_lng50",
      "k_xpm",
      "split_ha",
      "split_te",
      "opp",
      "bye",
      "trend",
      "proj",
    ];
  }
  if (key === "colsDEF") {
    return [
      "total",
      "avg",
      "high",
      "low",
      "sd",
      "gp",
      "rank",
      "tier",
      "d_sk",
      "d_int",
      "d_fr",
      "d_td",
      "d_pa",
      "d_ya",
      "split_ha",
      "split_te",
      "opp",
      "bye",
      "trend",
      "proj",
    ];
  }
  if (key === "colsIDP") {
    return [
      "total",
      "avg",
      "high",
      "low",
      "sd",
      "gp",
      "rank",
      "tier",
      "i_tkl",
      "i_sk",
      "i_int",
      "i_pd",
      "snap",
      "split_ha",
      "split_te",
      "opp",
      "bye",
      "trend",
      "proj",
    ];
  }
  return [
    "total",
    "avg",
    "high",
    "low",
    "sd",
    "gp",
    "rank",
    "tier",
    "snap",
    "tgt",
    "tgtsh",
    "aysh",
    "wopr",
    "rec_c",
    "tgt_c",
    "recyd",
    "car_c",
    "ryd_c",
    "pyd_c",
    "ptd_c",
    "ypc",
    "ypt",
    "catch",
    "fd",
    "split_ha",
    "split_te",
    "opp",
    "bye",
    "trend",
    "proj",
  ];
}

/** Factory defaults (prototype DEFAULTS; default sort PPG descending). */
export function defaultSettings(playedWeeks: number): Settings {
  return {
    fmt: "ppr",
    tePrem: false,
    ptd6: false,
    compact: false,
    range: "season",
    perGame: false,
    cwkFrom: 1,
    cwkTo: playedWeeks,
    rookieOnly: false,
    posFilter: "ALL",
    teamFilter: "ALL",
    injFilter: "ALL",
    byeFilter: "ALL",
    minGp: 0,
    query: "",
    cols: ["total", "avg", "sd", "snap", "tgt", "opp", "trend"],
    colsK: ["total", "avg", "k_fgm", "k_fgpct", "k_lng50", "k_xpm", "opp"],
    colsDEF: ["total", "avg", "d_sk", "d_int", "d_fr", "d_td", "d_pa", "opp"],
    colsIDP: ["total", "avg", "i_tkl", "i_sk", "i_int", "i_pd", "snap", "opp"],
    sort: ["avg", -1],
  };
}

/** Merges a stored (possibly stale/legacy) document over the defaults and
 * repairs it: legacy ranges, unknown columns, invalid sort. Never throws. */
export function sanitizeSettings(raw: unknown, playedWeeks: number): Settings {
  const defaults = defaultSettings(playedWeeks);
  if (typeof raw !== "object" || raw === null) return defaults;
  const merged = { ...defaults, ...(raw as Partial<Settings>) };
  // legacy last-5 / last-3 / single-week ranges collapse to Season
  if (
    (merged.range as string) !== "season" &&
    (merged.range as string) !== "custom"
  ) {
    merged.range = "season";
  }
  if (!["ppr", "half", "std"].includes(merged.fmt)) merged.fmt = defaults.fmt;
  for (const key of ["cols", "colsK", "colsDEF", "colsIDP"] as const) {
    const offered = colsOffered(key);
    const kept = Array.isArray(merged[key])
      ? merged[key].filter((colKey) => offered.includes(colKey))
      : [];
    merged[key] = kept.length ? kept : [...defaults[key]];
  }
  const validSortKeys = new Set([
    ...colsOffered("cols"),
    ...colsOffered("colsK"),
    ...colsOffered("colsDEF"),
    ...colsOffered("colsIDP"),
  ]);
  // the stored value is untrusted: view it as unknowns before narrowing
  const rawSort: unknown[] = Array.isArray(merged.sort) ? merged.sort : [];
  const sortKey = rawSort[0];
  const sortDir = rawSort[1];
  if (
    typeof sortKey === "string" &&
    validSortKeys.has(sortKey) &&
    (sortDir === 1 || sortDir === -1)
  ) {
    merged.sort = [sortKey, sortDir];
  } else {
    merged.sort = [...defaults.sort];
  }
  const num = (value: unknown, fallback: number): number =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  const rawObj = raw as Record<string, unknown>;
  merged.cwkFrom = Math.max(
    1,
    Math.min(18, num(rawObj.cwkFrom, defaults.cwkFrom)),
  );
  merged.cwkTo = Math.max(1, Math.min(18, num(rawObj.cwkTo, defaults.cwkTo)));
  merged.minGp = Math.max(0, Math.min(18, num(rawObj.minGp, defaults.minGp)));
  return merged;
}
