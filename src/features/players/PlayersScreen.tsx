/** The Players screen (player spec §2): control strip → result line → table →
 * compare tray → overlays (card / compare / columns, one at a time). Session
 * UI state (season PE3, ticks, card tabs) lives here; settings persist (F7). */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CURRENT_SEASON } from "@/lib/api/sources";
import { useSettings } from "@/lib/settings/SettingsProvider";
import { ColumnsModal } from "@/features/columns-modal/ColumnsModal";
import { CompareModal } from "@/features/compare/CompareModal";
import { CARD_TAB_CAP, PlayerCard } from "@/features/player-card/PlayerCard";
import { ControlStrip } from "./ControlStrip";
import { filterRows } from "./filtering";
import { PlayersTable } from "./PlayersTable";
import styles from "./players.module.css";
import { usePlayersModel } from "./usePlayersModel";

type Overlay = null | "card" | "compare" | "columns";

/** The /players route body. */
export function PlayersScreen() {
  const { settings, update, clearFilters } = useSettings();
  const searchParams = useSearchParams();

  // PE3: season is session state; the app always opens on the current season.
  const [season, setSeason] = useState(CURRENT_SEASON);
  const { model, rows, range, isLoading, error, retry } =
    usePlayersModel(season);

  // session UI state (never persisted; foundation §2.1)
  const [ticked, setTicked] = useState<string[]>([]);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [cardStack, setCardStack] = useState<string[]>([]);
  const [cardActive, setCardActive] = useState<string | null>(null);

  // /players?team=XXX applies the team filter (P1; NFL screen links here)
  // ?team=XXX deep link from the NFL screen pre-applies the team filter
  const teamParam = searchParams.get("team");
  useEffect(() => {
    if (teamParam) update({ teamFilter: teamParam.toUpperCase() });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apply once per param value
  }, [teamParam]);

  const filtered = useMemo(
    () => (model ? filterRows(rows, settings, model) : []),
    [rows, settings, model],
  );

  // badge counts modal filters only; position pills and range don't count
  const filterCount =
    (settings.teamFilter !== "ALL" ? 1 : 0) +
    (settings.injFilter !== "ALL" ? 1 : 0) +
    (settings.byeFilter !== "ALL" ? 1 : 0) +
    (settings.minGp > 0 ? 1 : 0) +
    (settings.rookieOnly ? 1 : 0);
  const filtersActive = filterCount > 0 || settings.query.trim() !== "";

  const openCard = useCallback((id: string) => {
    setCardStack((stack) => {
      if (stack.includes(id)) return stack;
      const next = [...stack, id];
      // over the tab cap, the oldest open card drops off
      return next.length > CARD_TAB_CAP ? next.slice(1) : next;
    });
    setCardActive(id);
    setOverlay("card");
  }, []);

  const closeCardTab = useCallback(
    (id: string) => {
      setCardStack((stack) => {
        const next = stack.filter((pickedId) => pickedId !== id);
        if (!next.length) {
          setOverlay(null);
          setCardActive(null);
        } else if (cardActive === id) {
          setCardActive(next[next.length - 1] ?? null);
        }
        return next;
      });
    },
    [cardActive],
  );

  const toggleTick = useCallback((id: string) => {
    setTicked((current) =>
      current.includes(id)
        ? current.filter((pickedId) => pickedId !== id)
        : current.length >= 4
          ? current
          : [...current, id],
    );
  }, []);

  const removeFromCompare = useCallback((id: string) => {
    setTicked((current) => {
      const next = current.filter((pickedId) => pickedId !== id);
      // compare needs 2+ players; dropping below closes the modal
      if (next.length < 2) setOverlay(null);
      return next;
    });
  }, []);

  // error state: say what failed and offer retry — never a fake-empty table
  if (error) {
    return (
      <section>
        <Head season={season} model={null} />
        <div className={`${styles.banner} ${styles.bannerErr}`} role="alert">
          Couldn&apos;current load player data: {error.message}
          <button
            type="button"
            className={styles.btn}
            onClick={retry}
            style={{ marginLeft: "auto" }}
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  // loading state: skeleton rows under the real layout
  if (isLoading || !model) {
    return (
      <section aria-busy="true">
        <Head season={season} model={null} />
        <div className={styles.card}>
          {Array.from({ length: 12 }, (_, index) => (
            <div key={index} className={styles.skrow}>
              <span
                className={styles.sk}
                style={{ width: 28, height: 28, borderRadius: "50%" }}
              />
              <span
                className={styles.sk}
                style={{ width: `${String(30 + ((index * 13) % 40))}%` }}
              />
              <span
                className={styles.sk}
                style={{ width: "10%", marginLeft: "auto" }}
              />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section>
      <Head season={season} model={model} />
      <ControlStrip
        model={model}
        season={season}
        onSeason={(year) => {
          setSeason(year);
        }}
        filterCount={filterCount}
        onOpenColumns={() => {
          setOverlay("columns");
        }}
      />

      <div className={styles.resultline}>
        <span className={styles.count} aria-live="polite">
          {filtered.length} player{filtered.length === 1 ? "" : "s"} match
        </span>
        {filtersActive && (
          <button
            type="button"
            className={styles.linkbtn}
            onClick={clearFilters}
          >
            Clear all
          </button>
        )}
      </div>

      {/* no-matches state keeps Clear all within reach (brief: states table) */}
      {filtered.length === 0 ? (
        <div className={styles.card}>
          <div className={styles.inlineEmpty}>
            <b>0 players match</b>
            Filters or search exclude every player.
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                className={styles.linkbtn}
                onClick={clearFilters}
              >
                Clear all filters
              </button>
            </div>
          </div>
        </div>
      ) : (
        <PlayersTable
          model={model}
          rows={filtered}
          ticked={ticked}
          onTick={toggleTick}
          onOpen={openCard}
        />
      )}

      {/* compare tray appears with the first tick */}
      {ticked.length > 0 && (
        <div className={styles.cmptray}>
          <span className={styles.traylab}>Compare {ticked.length}/4</span>
          {ticked.map((id) => {
            const player = model.playerById.get(id);
            if (!player) return null;
            return (
              <span key={id} className={styles.chip}>
                {player.name}
                <button
                  type="button"
                  aria-label={`Remove ${player.name}`}
                  onClick={() => {
                    setTicked((current) =>
                      current.filter((pickedId) => pickedId !== id),
                    );
                  }}
                >
                  ×
                </button>
              </span>
            );
          })}
          <button
            type="button"
            className={`${styles.btn} ${ticked.length >= 2 ? styles.btnPrimary : ""}`}
            disabled={ticked.length < 2}
            onClick={() => {
              setOverlay("compare");
            }}
          >
            Compare {ticked.length}
          </button>
          <button
            type="button"
            className={styles.linkbtn}
            onClick={() => {
              setTicked([]);
            }}
          >
            Clear
          </button>
        </div>
      )}

      <p className={styles.footnote}>
        PPG divides by games actually played; byes and missed weeks are gaps,
        never zeros. Matchup difficulty is the opponent&apos;s rank in fantasy
        points allowed to the position (1st = fewest/Tough, 32nd = most/Easy).
      </p>

      {overlay === "card" && cardActive && (
        <PlayerCard
          stack={cardStack}
          active={cardActive}
          onActivate={setCardActive}
          onCloseTab={closeCardTab}
          onClose={() => {
            setOverlay(null);
            setCardStack([]);
            setCardActive(null);
          }}
          onTeamFilter={(team) => {
            setOverlay(null);
            setCardStack([]);
            setCardActive(null);
            update({ teamFilter: team });
          }}
        />
      )}
      {overlay === "compare" && (
        <CompareModal
          model={model}
          range={range}
          ids={ticked}
          onRemove={removeFromCompare}
          onOpenPlayer={(id) => {
            setOverlay(null);
            openCard(id);
          }}
          onClearAll={() => {
            setTicked([]);
            setOverlay(null);
          }}
          onClose={() => {
            setOverlay(null);
          }}
        />
      )}
      {overlay === "columns" && (
        <ColumnsModal
          model={model}
          onClose={() => {
            setOverlay(null);
          }}
        />
      )}
    </section>
  );
}

function Head({
  season,
  model,
}: {
  season: number;
  model: { playedWeeks: number; isCurrent: boolean } | null;
}) {
  const sub = model
    ? model.isCurrent
      ? `Every NFL player, refreshed daily. ${String(season)} season · through Week ${String(model.playedWeeks)}.`
      : `${String(season)} season · final.`
    : "Loading…";
  return (
    <div className={styles.vhead}>
      <div>
        <h1>Players</h1>
        <p className={styles.sub}>{sub}</p>
      </div>
    </div>
  );
}
