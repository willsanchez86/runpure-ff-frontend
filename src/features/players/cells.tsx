/** Shared cell renderers (player spec §4.1; design-language rules: gaps never
 * zeros, averages beside games played, colour never the only cue). */
import type { ReactNode } from "react";
import type { Matchup, SeasonModel } from "@/lib/scoring/types";
import styles from "./players.module.css";

/** A gap, not a zero (design language). */
export function Gap({ text = "—" }: { text?: string }) {
  return (
    <span className={styles.gap} title="A gap, not a zero — no game in range">
      {text}
    </span>
  );
}

/** One fantasy number to one decimal (design language). */
export const f1 = (v: number): string => v.toFixed(1);

/** Ordinal for matchup ranks (1st = fewest points allowed). */
export const ord = (rank: number): string => {
  const rem10 = rank % 10;
  const rem100 = rank % 100;
  const suffix =
    // 11th/12th/13th take "th" despite ending in 1/2/3
    rem100 >= 11 && rem100 <= 13
      ? "th"
      : rem10 === 1
        ? "st"
        : rem10 === 2
          ? "nd"
          : rem10 === 3
            ? "rd"
            : "th";
  return `${String(rank)}${suffix}`;
};

/** Matchup chip: coloured dot + rank; the Easy/Even/Tough WORD rides on
 * title/aria so colour is never the only cue (design language). */
export function MatchChip({ matchup }: { matchup: Matchup }) {
  const color =
    matchup.label === "Easy"
      ? "var(--good)"
      : matchup.label === "Tough"
        ? "var(--crit)"
        : "var(--muted)";
  return (
    <span
      className={styles.ease}
      title={`${matchup.label} matchup (${ord(matchup.rank)})`}
    >
      <i
        style={{ background: color }}
        role="img"
        aria-label={`${matchup.label} matchup`}
      />
      {ord(matchup.rank)}
    </span>
  );
}

/** SNP% bar: number + track (number always shown). */
export function SnapBar({ value }: { value: number }) {
  const pct = Math.round(value);
  return (
    <span className={styles.snapbar}>
      <span className="num">{pct}%</span>
      <span className={styles.snaptrack}>
        <span
          className={styles.snapfill}
          style={{ width: `${String(pct)}%` }}
        />
      </span>
    </span>
  );
}

/** Positional tier from season rank (T1 elite … T5 deep). */
export function TierCell({ rank, pos }: { rank: number | null; pos: string }) {
  if (!rank) return <Gap />;
  const tier =
    rank <= 5 ? 1 : rank <= 12 ? 2 : rank <= 24 ? 3 : rank <= 36 ? 4 : 5;
  const colors = [
    "var(--good)",
    "var(--accent)",
    "var(--te)",
    "var(--serious)",
    "var(--muted)",
  ];
  return (
    <span className={styles.tier} title={`Season rank ${pos}${String(rank)}`}>
      <i style={{ background: colors[tier - 1] }} />T{tier}
    </span>
  );
}

/** One side of a split pair (PPG + games), or null when no games. */
type SplitCellValue = { ppg: number; games: number } | null;

/** Split pair: two PPG values with games-played labels (sample size shown). */
export function SplitPair({
  left,
  right,
  leftLabel,
  rightLabel,
}: {
  left: SplitCellValue;
  right: SplitCellValue;
  leftLabel: string;
  rightLabel: string;
}) {
  const one = (cell: SplitCellValue, label: string): ReactNode => (
    <span className={styles.sp}>
      <span className={cell ? "num" : styles.gap}>
        {cell ? f1(cell.ppg) : "—"}
      </span>
      <span className={styles.spl}>
        {label} · {cell ? cell.games : 0}g
      </span>
    </span>
  );
  return (
    <span className={styles.splitpair}>
      {one(left, leftLabel)}
      {one(right, rightLabel)}
    </span>
  );
}

/** Weekly points sparkline: gaps break the line, never drawn as zeros. */
export function Spark({
  model,
  playerId,
  name,
}: {
  model: SeasonModel;
  playerId: string;
  name: string;
}) {
  const width = 104;
  const height = 24;
  const weeks = model.weeks.get(playerId);
  const upto = model.playedWeeks;
  const vals: (number | null)[] = [];
  for (let week = 1; week <= upto; week++) {
    const entry = weeks?.get(week);
    vals.push(entry?.kind === "played" ? entry.pts : null);
  }
  const nums = vals.filter((value): value is number => value != null);
  if (!nums.length) {
    return (
      <span className={styles.gap} style={{ fontSize: 11 }}>
        no games
      </span>
    );
  }
  const mx = Math.max(10, ...nums);
  const xAt = (index: number) =>
    3 + (index * (width - 6)) / Math.max(1, upto - 1);
  const yAt = (value: number) =>
    height - 3 - (Math.max(0, value) / mx) * (height - 7);
  let pathD = "";
  let pen = false;
  let lastIdx = -1;
  vals.forEach((value, index) => {
    if (value != null) {
      pathD += `${pen ? "L" : "M"}${xAt(index).toFixed(1)} ${yAt(value).toFixed(1)}`;
      pen = true;
      lastIdx = index;
      // a gap lifts the pen: the line visibly breaks at byes/missed weeks
    } else pen = false;
  });
  const last = lastIdx >= 0 ? vals[lastIdx] : null;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      role="img"
      aria-label={`Weekly points sparkline for ${name}; byes and missed weeks are gaps`}
    >
      <line
        x1={0}
        x2={width}
        y1={height - 3}
        y2={height - 3}
        stroke="var(--line-2)"
      />
      <path
        d={pathD}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {last != null && (
        <circle
          cx={xAt(lastIdx)}
          cy={yAt(last)}
          r={2.6}
          fill="var(--accent-2)"
        />
      )}
    </svg>
  );
}

/** Initials avatar disc (prototype look; no external images in Phase 1). */
export function Avatar({
  name,
  id,
  size = 28,
}: {
  name: string;
  id: string;
  size?: number;
}) {
  // deterministic hue per player id, so avatars are stable
  const hue = (Number(id) * 47) % 360;
  const initials = name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className={styles.av}
      aria-hidden
      style={{
        width: size,
        height: size,
        fontSize: size * 0.39,
        background: `linear-gradient(140deg, hsl(${String(hue)} 45% 62%), hsl(${String(hue)} 40% 44%))`,
      }}
    >
      {initials}
    </span>
  );
}

/** Inline injury word beside the name (always text, never colour-only). */
export function InjuryWord({
  status,
  practice,
}: {
  status: string | null;
  practice: string | null;
}) {
  if (!status) return null;
  const word = status === "Q" ? "QUES" : status === "O" ? "OUT" : "IR";
  const cls =
    status === "Q" ? styles.injQ : status === "O" ? styles.injO : styles.injIR;
  return (
    <span
      className={`${styles.injword} ${cls}`}
      title={practice ? `Practice: ${practice}` : undefined}
    >
      {word}
    </span>
  );
}

/** Position tag — colour always paired with the text label (design language). */
export function PosTag({ pos, small }: { pos: string; small?: boolean }) {
  return (
    <span
      className={`${styles.pos} ${small ? styles.posSmall : ""}`}
      data-pos={pos}
    >
      {pos}
    </span>
  );
}
