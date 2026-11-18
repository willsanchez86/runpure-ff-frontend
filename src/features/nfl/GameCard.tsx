/** One game card (NFL spec §4): kickoff + status header, away/home team rows
 * with the team link to /players?team=XXX, the stadium/line footer, and the
 * expandable detail panel (NS2 adds rest days and the division marker). */
"use client";

import { useState } from "react";
import Link from "next/link";
import type { Game } from "@/lib/api/contract";
import type { TeamInfo } from "@/lib/scoring/types";
import { favoriteText, gap, kickoffParts } from "./nflHelpers";
import styles from "./nfl.module.css";

/** Deterministic chip hue from the team code (fallback when no logo). */
function teamHue(abbr: string): number {
  let hash = 0;
  for (const char of abbr) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

/** The real team logo (nflverse URL); sources without one (sample data)
 * fall back to the coloured abbreviation block. */
function TeamChip({
  abbr,
  team,
}: {
  abbr: string;
  team: TeamInfo | undefined;
}) {
  if (team?.logoUrl) {
    return (
      // plain <img>: tiny third-party-hosted logos gain nothing from the
      // next/image optimizer, which would proxy every remote host
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={styles.tlogo}
        src={team.logoUrl}
        alt=""
        loading="lazy"
        width={30}
        height={30}
      />
    );
  }
  return (
    <span
      className={styles.tchip}
      aria-hidden
      style={{
        background:
          team?.color ??
          `linear-gradient(140deg, hsl(${String(teamHue(abbr))} 42% 60%), hsl(${String(teamHue(abbr))} 38% 44%))`,
      }}
    >
      {abbr}
    </span>
  );
}

function TeamRow({
  abbr,
  team,
  score,
  won,
  lost,
  overtime,
  kickoffLabel,
}: {
  abbr: string;
  team: TeamInfo | undefined;
  score: number | null;
  won: boolean;
  lost: boolean;
  /** Overtime tag renders beside the winner's score only. */
  overtime: boolean;
  /** Shown instead of a score while the game is unplayed; null once final. */
  kickoffLabel: string | null;
}) {
  return (
    <div
      className={`${styles.gteam} ${won ? styles.win : ""} ${lost ? styles.lose : ""}`}
    >
      <TeamChip abbr={abbr} team={team} />
      <div>
        <div className={styles.tn}>
          <Link href={`/players?team=${abbr}`}>{team?.name ?? abbr}</Link>
          {/* winner styling is never the only cue (a11y §8) */}
          {won && <span className="sr-only"> — won</span>}
          {lost && <span className="sr-only"> — lost</span>}
        </div>
        <div className={styles.rec}>{team?.division ?? ""}</div>
      </div>
      {kickoffLabel !== null ? (
        <span className={styles.when}>{kickoffLabel}</span>
      ) : (
        <span className={`${styles.sc} num`}>
          {score ?? "—"}
          {won && overtime && <span className={styles.ot}>OT</span>}
        </span>
      )}
    </div>
  );
}

/** The card; `teams` resolves names, divisions and (via the game) venue. */
export function GameCard({
  game,
  teams,
}: {
  game: Game;
  teams: Map<string, TeamInfo>;
}) {
  const [open, setOpen] = useState(false);
  const { day, time } = kickoffParts(game.kickoff);
  const played = game.final;
  const homeWon =
    played && game.homeScore !== null && game.awayScore !== null
      ? game.homeScore > game.awayScore
      : false;
  const awayWon =
    played && game.homeScore !== null && game.awayScore !== null
      ? game.awayScore > game.homeScore
      : false;
  const fav = favoriteText(game);

  return (
    <div className={styles.game}>
      <div className={styles.ghead}>
        <span>
          {day} · {time} ET
        </span>
        <span
          className={`${styles.st} ${played ? styles.stFinal : styles.stUp}`}
        >
          {played ? (game.overtime ? "Final / OT" : "Final") : "Upcoming"}
        </span>
      </div>
      <TeamRow
        abbr={game.awayTeam}
        team={teams.get(game.awayTeam)}
        score={game.awayScore}
        won={awayWon}
        lost={homeWon}
        overtime={game.overtime}
        kickoffLabel={played ? null : time}
      />
      <TeamRow
        abbr={game.homeTeam}
        team={teams.get(game.homeTeam)}
        score={game.homeScore}
        won={homeWon}
        lost={awayWon}
        overtime={game.overtime}
        kickoffLabel={played ? null : time}
      />
      <div className={styles.gameline}>
        <span>{gap(game.stadium)}</span>
        <span className={styles.lineRight}>
          {fav ?? "—"} · O/U {gap(game.totalLine)}
        </span>
      </div>
      <button
        type="button"
        className={styles.gtoggle}
        aria-expanded={open}
        onClick={() => {
          setOpen((wasOpen) => !wasOpen);
        }}
      >
        Game detail
      </button>
      {open && (
        <div className={styles.gdetail}>
          <dl>
            <dt>Stadium</dt>
            <dd>{gap(game.stadium)}</dd>
            <dt>Roof</dt>
            <dd>{gap(game.roof)}</dd>
            <dt>Surface</dt>
            <dd>{gap(game.surface)}</dd>
            <dt>Temp</dt>
            <dd>{gap(game.temperatureF, "°F")}</dd>
            <dt>Wind</dt>
            <dd>{gap(game.windMph, " mph")}</dd>
            <dt>Line</dt>
            <dd>{fav ?? "—"}</dd>
            <dt>Total</dt>
            <dd>{gap(game.totalLine)}</dd>
            <dt>Starting QBs</dt>
            <dd>
              {gap(game.awayQb)} ({game.awayTeam}) · {gap(game.homeQb)} (
              {game.homeTeam})
            </dd>
            <dt>Head coaches</dt>
            <dd>
              {gap(game.awayCoach)} · {gap(game.homeCoach)}
            </dd>
            {/* NS2: rest days and the division marker, from the feed */}
            <dt>Rest days</dt>
            <dd>
              {game.awayTeam} {gap(game.awayRestDays)} · {game.homeTeam}{" "}
              {gap(game.homeRestDays)}
            </dd>
            <dt>Division game</dt>
            <dd>{game.divisionGame ? "Yes" : "—"}</dd>
          </dl>
        </div>
      )}
    </div>
  );
}
