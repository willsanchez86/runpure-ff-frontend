/** The NFL scores & schedule screen (NFL spec §2): phase + week controls,
 * the game grid, and the byes block. Phase and week are session state — the
 * screen always opens on the NS1 default (regular season, current week). */
"use client";

import { useMemo, useState } from "react";
import { CURRENT_SEASON } from "@/lib/api/sources";
import { useSeasonModel } from "@/features/players/usePlayersModel";
import { GameCard } from "./GameCard";
import {
  byeTeams,
  defaultSlate,
  gamesFor,
  phaseDefaultWeek,
  phaseWeeks,
  type Phase,
  type Slate,
} from "./nflHelpers";
import styles from "./nfl.module.css";

const PHASES: { value: Phase; label: string }[] = [
  { value: "PRE", label: "Preseason" },
  { value: "REG", label: "Regular" },
  { value: "POST", label: "Postseason" },
];

/** The /nfl route body. */
export function NflScreen() {
  const { model, isLoading, error, retry } = useSeasonModel(CURRENT_SEASON);

  // null until the user picks; the effective slate falls back to NS1's default
  const [picked, setPicked] = useState<Slate | null>(null);
  const slate: Slate | null = useMemo(() => {
    if (!model) return null;
    return picked ?? defaultSlate(model.games);
  }, [model, picked]);

  const weeks = useMemo(
    () => (model && slate ? phaseWeeks(model.games, slate.phase) : []),
    [model, slate],
  );
  const games = useMemo(
    () => (model && slate ? gamesFor(model.games, slate) : []),
    [model, slate],
  );
  const byes = useMemo(
    () => (model && slate ? byeTeams(model.teamsByAbbr.values(), slate) : []),
    [model, slate],
  );

  if (error) {
    return (
      <section>
        <Head model={null} />
        <div className={styles.errbox} role="alert">
          <b>Couldn’t load schedule data</b>
          <p>{error.message}</p>
          <button type="button" className={styles.btn} onClick={retry}>
            Retry
          </button>
        </div>
      </section>
    );
  }

  if (isLoading || !model || !slate) {
    return (
      <section aria-busy="true">
        <Head model={null} />
        <div className={styles.gamegrid}>
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className={styles.game}>
              <div className={styles.skbody}>
                <span className={styles.sk} style={{ width: "40%" }} />
                <span className={styles.sk} style={{ width: "70%" }} />
                <span className={styles.sk} style={{ width: "65%" }} />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const weekIndex = weeks.indexOf(slate.week);
  const setWeek = (week: number) => {
    setPicked({ phase: slate.phase, week });
  };
  const weekLabel = (week: number): string => {
    if (slate.phase !== "REG" || !model.isCurrent)
      return `Week ${String(week)}`;
    if (week === model.currentWeek) return `Week ${String(week)} (current)`;
    if (week > model.playedWeeks) return `Week ${String(week)} (upcoming)`;
    return `Week ${String(week)}`;
  };

  return (
    <section>
      <Head model={model} />

      <div className={styles.toolbar}>
        <div className={styles.tgroup}>
          <span className={styles.lab}>Phase</span>
          <div className={styles.seg} role="radiogroup" aria-label="Phase">
            {PHASES.map((phase) => (
              <button
                key={phase.value}
                type="button"
                role="radio"
                aria-checked={slate.phase === phase.value}
                className={slate.phase === phase.value ? styles.segOn : ""}
                onClick={() => {
                  setPicked({
                    phase: phase.value,
                    week: phaseDefaultWeek(model.games, phase.value),
                  });
                }}
              >
                {phase.label}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.tgroup}>
          <label className={styles.lab} htmlFor="nfl-week">
            Week
          </label>
          <select
            id="nfl-week"
            className={styles.weeksel}
            value={slate.week}
            onChange={(event) => {
              setWeek(Number(event.target.value));
            }}
          >
            {weeks.map((week) => (
              <option key={week} value={week}>
                {weekLabel(week)}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.spacer} />
        <button
          type="button"
          className={styles.btn}
          disabled={weekIndex <= 0}
          aria-label="Previous week"
          onClick={() => {
            setWeek(weeks[weekIndex - 1] ?? slate.week);
          }}
        >
          ‹ Prev
        </button>
        <button
          type="button"
          className={styles.btn}
          disabled={weekIndex < 0 || weekIndex >= weeks.length - 1}
          aria-label="Next week"
          onClick={() => {
            setWeek(weeks[weekIndex + 1] ?? slate.week);
          }}
        >
          Next ›
        </button>
      </div>

      {games.length > 0 ? (
        <div className={styles.gamegrid}>
          {games.map((game) => (
            <GameCard key={game.id} game={game} teams={model.teamsByAbbr} />
          ))}
        </div>
      ) : (
        <div className={styles.emptybox}>
          <b>No games in this week</b>
          The {String(model.season)} feed carries no{" "}
          {slate.phase === "PRE"
            ? "preseason"
            : slate.phase === "POST"
              ? "postseason"
              : "regular-season"}{" "}
          games for week {String(slate.week)}.
        </div>
      )}

      {byes.length > 0 && (
        <div className={styles.byes}>
          <h3>
            On bye — Week {String(slate.week)} ({String(byes.length)} teams)
          </h3>
          <div className={styles.byelist}>
            {byes.map((team) => (
              <span
                key={team.abbr}
                className={styles.byechip}
                title={team.name}
              >
                {team.abbr}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className={styles.note}>
        Click a game for stadium, roof, surface, weather, the betting line,
        starting quarterbacks, head coaches, rest days and the division marker.
        A team name opens the Players list filtered to that team. Scores land
        with the daily refresh — no live in-game states.
      </p>
    </section>
  );
}

function Head({
  model,
}: {
  model: { season: number; playedWeeks: number; isCurrent: boolean } | null;
}) {
  const sub = model
    ? model.isCurrent
      ? `${String(model.season)} season · scores through Week ${String(model.playedWeeks)}. Not live: scores land with the daily refresh.`
      : `${String(model.season)} season · final.`
    : "Loading…";
  return (
    <div className={styles.vhead}>
      <div>
        <h1>NFL scores &amp; schedule</h1>
        <p className={styles.sub}>{sub}</p>
      </div>
    </div>
  );
}
