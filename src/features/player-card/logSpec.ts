/** Per-position game-log column groups (player spec §6.2; prototype logSpec).
 * Each column reads a typed StatLine; heat polarity is position-aware. */
import type { StatLine } from "@/lib/api/contract";

/** One game-log stat column. */
export interface LogCol {
  /** Stat key: heat-map domain id and the position's bad-stat lookup. */
  k: string;
  label: string;
  get: (l: StatLine) => number | null;
  /** Renders a non-null value; omitted = integer default (branch-by-data). */
  format?: (v: number) => string;
  /** FPTS column (bold, heat-mapped). */
  fpts?: boolean;
  /** PROJ designed-for stub column. */
  proj?: boolean;
}

/** [group label, columns] pairs for a position. */
export type LogGroup = [string, LogCol[]];

const col = (
  key: string,
  label: string,
  get: (line: StatLine) => number | null,
  extra?: Partial<LogCol>,
): LogCol => ({
  k: key,
  label,
  get,
  ...extra,
});

const pct0 = (v: number): string => `${String(Math.round(v))}%`;
const pct1 = (v: number): string => `${v.toFixed(1)}%`;
const dec1 = (v: number): string => v.toFixed(1);
const dec2 = (v: number): string => v.toFixed(2);

const FAN: LogGroup = [
  "FANTASY",
  [
    col("proj", "PROJ", () => null, { proj: true }),
    col("fpts", "FPTS", () => null, { fpts: true, format: dec1 }),
  ],
];
const SNP: LogGroup = [
  "",
  [col("snap", "SNP%", (line) => line.snapPct, { format: pct0 })],
];

/** The grouped columns for a position's game log. */
export function logSpec(pos: string): LogGroup[] {
  if (pos === "QB") {
    return [
      FAN,
      SNP,
      [
        "PASSING",
        [
          col("att", "ATT", (line) =>
            line.position === "QB" ? line.attempts : null,
          ),
          col("cmp", "CMP", (line) =>
            line.position === "QB" ? line.completions : null,
          ),
          col("pyd", "YD", (line) =>
            line.position === "QB" ? line.passYards : null,
          ),
          col("ptd", "TD", (line) =>
            line.position === "QB" ? line.passTds : null,
          ),
          col("int", "INT", (line) =>
            line.position === "QB" ? line.interceptions : null,
          ),
        ],
      ],
      [
        "RUSHING",
        [
          col("car", "ATT", (line) =>
            line.position === "QB" ? line.carries : null,
          ),
          col("ryd", "YD", (line) =>
            line.position === "QB" ? line.rushYards : null,
          ),
          col(
            "ypc",
            "YPC",
            (line) =>
              line.position === "QB" && line.carries
                ? line.rushYards / line.carries
                : null,
            { format: dec1 },
          ),
          col("rtd", "TD", (line) =>
            line.position === "QB" ? line.rushTds : null,
          ),
        ],
      ],
      [
        "SACKED",
        [
          col("sk", "SK", (line) =>
            line.position === "QB" ? line.sacksTaken : null,
          ),
          col("skyd", "YDS", (line) =>
            line.position === "QB" ? line.sackYards : null,
          ),
        ],
      ],
      [
        "FUMBLE",
        [
          col("fum", "FUM", (line) =>
            "fumbles" in line ? line.fumbles : null,
          ),
          col("fuml", "LOST", (line) =>
            "fumblesLost" in line ? line.fumblesLost : null,
          ),
        ],
      ],
    ];
  }
  if (pos === "RB") {
    return [
      FAN,
      SNP,
      [
        "RUSHING",
        [
          col("car", "ATT", (line) =>
            line.position === "RB" ? line.carries : null,
          ),
          col("ryd", "YD", (line) =>
            line.position === "RB" ? line.rushYards : null,
          ),
          col(
            "ypc",
            "YPC",
            (line) =>
              line.position === "RB" && line.carries
                ? line.rushYards / line.carries
                : null,
            { format: dec1 },
          ),
          col("rtd", "TD", (line) =>
            line.position === "RB" ? line.rushTds : null,
          ),
        ],
      ],
      [
        "RECEIVING",
        [
          col("tg", "TGT", (line) =>
            line.position === "RB" ? line.targets : null,
          ),
          col("rec", "REC", (line) =>
            line.position === "RB" ? line.receptions : null,
          ),
          col("cyd", "YD", (line) =>
            line.position === "RB" ? line.recYards : null,
          ),
          col("ctd", "TD", (line) =>
            line.position === "RB" ? line.recTds : null,
          ),
        ],
      ],
      [
        "FUMBLE",
        [
          col("fum", "FUM", (line) =>
            "fumbles" in line ? line.fumbles : null,
          ),
          col("fuml", "LOST", (line) =>
            "fumblesLost" in line ? line.fumblesLost : null,
          ),
        ],
      ],
    ];
  }
  if (pos === "WR" || pos === "TE") {
    const wt = (line: StatLine) =>
      line.position === "WR" || line.position === "TE" ? line : null;
    return [
      FAN,
      SNP,
      [
        "RECEIVING",
        [
          col("tg", "TGT", (line) => wt(line)?.targets ?? null),
          col("rec", "REC", (line) => wt(line)?.receptions ?? null),
          col("cyd", "YD", (line) => wt(line)?.recYards ?? null),
          col(
            "ypt",
            "Y/T",
            (line) => {
              const scoped = wt(line);
              return scoped?.targets ? scoped.recYards / scoped.targets : null;
            },
            { format: dec1 },
          ),
          col("ctd", "TD", (line) => wt(line)?.recTds ?? null),
        ],
      ],
      [
        "USAGE",
        [
          col(
            "tgtsh",
            "TGT%",
            (line) => {
              const share = wt(line)?.targetShare;
              return share == null ? null : share * 100;
            },
            { format: pct1 },
          ),
          col(
            "aysh",
            "AY%",
            (line) => {
              const share = wt(line)?.airYardsShare;
              return share == null ? null : share * 100;
            },
            { format: pct1 },
          ),
          col("wopr", "WOPR", (line) => wt(line)?.wopr ?? null, {
            format: dec2,
          }),
        ],
      ],
      [
        "FUMBLE",
        [
          col("fum", "FUM", (line) =>
            "fumbles" in line ? line.fumbles : null,
          ),
          col("fuml", "LOST", (line) =>
            "fumblesLost" in line ? line.fumblesLost : null,
          ),
        ],
      ],
    ];
  }
  if (pos === "K") {
    const kk = (line: StatLine) => (line.position === "K" ? line : null);
    return [
      FAN,
      [
        "KICKING",
        [
          col("fg", "FGM", (line) => kk(line)?.fgMade ?? null),
          col("fga", "FGA", (line) => {
            const scoped = kk(line);
            return scoped ? scoped.fgMade + scoped.fgMissed : null;
          }),
          col(
            "fgpct",
            "FG%",
            (line) => {
              const scoped = kk(line);
              const attempts = scoped ? scoped.fgMade + scoped.fgMissed : 0;
              return scoped && attempts
                ? (100 * scoped.fgMade) / attempts
                : null;
            },
            { format: pct0 },
          ),
          col("fg50", "50+", (line) => kk(line)?.fg50Plus ?? null),
          col("xp", "XPM", (line) => kk(line)?.xpMade ?? null),
        ],
      ],
    ];
  }
  if (pos === "DEF") {
    const dd = (line: StatLine) => (line.position === "DEF" ? line : null);
    return [
      FAN,
      [
        "DEFENSE",
        [
          col("sk", "SK", (line) => dd(line)?.sacks ?? null),
          col("int", "INT", (line) => dd(line)?.interceptions ?? null),
          col("fr", "FR", (line) => dd(line)?.fumbleRecoveries ?? null),
          col("td", "TD", (line) => dd(line)?.tds ?? null),
          col("saf", "SAF", (line) => dd(line)?.safeties ?? null),
        ],
      ],
      [
        "SCORING",
        [
          col("pa", "PA", (line) => dd(line)?.pointsAllowed ?? null),
          col("ya", "YDA", (line) => dd(line)?.yardsAllowed ?? null),
        ],
      ],
    ];
  }
  const ii = (line: StatLine) =>
    line.position === "DB" || line.position === "LB" || line.position === "DL"
      ? line
      : null;
  return [
    FAN,
    SNP,
    [
      "TACKLES",
      [
        col("solo", "SOLO", (line) => ii(line)?.soloTackles ?? null),
        col("ast", "AST", (line) => ii(line)?.assistTackles ?? null),
        col("tot", "TOT", (line) => {
          const scoped = ii(line);
          return scoped ? scoped.soloTackles + scoped.assistTackles : null;
        }),
      ],
    ],
    [
      "IMPACT",
      [
        col("sk", "SK", (line) => ii(line)?.sacks ?? null),
        col("tfl", "TFL", (line) => ii(line)?.tacklesForLoss ?? null),
        col("int", "INT", (line) => ii(line)?.interceptions ?? null),
        col("pd", "PD", (line) => ii(line)?.passesDefended ?? null),
        col("ff", "FF", (line) => ii(line)?.forcedFumbles ?? null),
        col("fr", "FR", (line) => ii(line)?.fumbleRecoveries ?? null),
      ],
    ],
  ];
}

/** Position-aware heat polarity (player spec §6.2): these keys shade red. */
export const BAD_KEYS: Record<string, Set<string>> = {
  QB: new Set(["int", "sk", "skyd", "fum", "fuml"]),
  RB: new Set(["fum", "fuml"]),
  WR: new Set(["fum", "fuml"]),
  TE: new Set(["fum", "fuml"]),
  DEF: new Set(["pa", "ya"]),
};
