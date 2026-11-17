/** The Player card (player spec §6): modal with player tabs (cap 6), the
 * persistent header (hero, bio, rankings, status row, news rail) and section
 * tabs that swap content. Follows the list's scoring and range controls. */
"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/overlay/Modal";
import { CURRENT_SEASON } from "@/lib/api/sources";
import { matchup } from "@/lib/scoring/engine";
import type { RangeConfig, SeasonModel } from "@/lib/scoring/types";
import { useSettings } from "@/lib/settings/SettingsProvider";
import { Avatar, MatchChip, PosTag } from "@/features/players/cells";
import { useSeasonModel } from "@/features/players/usePlayersModel";
import { GameLog } from "./GameLog";
import { History, Overview, Splits, Trends } from "./sections";
import styles from "./card.module.css";

/** Open-card tab cap (player spec §6.1). */
export const CARD_TAB_CAP = 6;

const SECTIONS = [
  "Overview",
  "Game log",
  "Splits",
  "Trends",
  "History",
] as const;
type Section = (typeof SECTIONS)[number];

/** The card modal. `stack` is the open tabs (session state, owned by the
 * screen); `active` the shown player. */
export function PlayerCard({
  stack,
  active,
  onActivate,
  onCloseTab,
  onClose,
  onTeamFilter,
}: {
  stack: string[];
  active: string;
  onActivate: (id: string) => void;
  onCloseTab: (id: string) => void;
  onClose: () => void;
  onTeamFilter: (team: string) => void;
}) {
  const { settings } = useSettings();
  const [section, setSection] = useState<Section>("Overview");
  const [logSeason, setLogSeason] = useState<number>(CURRENT_SEASON);
  // header/tabs key off the current season; sections fetch their own seasons
  const { model } = useSeasonModel(CURRENT_SEASON);

  // the active stat window: full season or custom weeks (cwkFrom–cwkTo),
  // with counting stats shown per game when toggled
  const range: RangeConfig = useMemo(
    () => ({
      kind: settings.range,
      from: settings.cwkFrom,
      to: settings.cwkTo,
      perGame: settings.perGame,
    }),
    [settings],
  );

  // nothing renders until the current season's model exists
  if (!model) return null;
  const player = model.playerById.get(active);
  if (!player) return null;

  const fmtLabel =
    settings.fmt === "ppr"
      ? "Full PPR"
      : settings.fmt === "half"
        ? "Half PPR"
        : "Standard";

  return (
    <Modal label={`Player card: ${player.name}`} onClose={onClose}>
      <div className={styles.top}>
        <div
          className={styles.tabstrip}
          role="tablist"
          aria-label="Open players"
        >
          {stack.map((id) => {
            const player2 = model.playerById.get(id);
            if (!player2) return null;
            const on = id === active;
            const last = player2.name.split(" ").slice(-1)[0] ?? player2.name;
            return (
              <span
                key={id}
                className={`${styles.ptab} ${on ? styles.ptabOn : ""}`}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={on}
                  className={styles.ptabSel}
                  onClick={() => {
                    onActivate(id);
                  }}
                >
                  <PosTag pos={player2.position} small />
                  {last} {player2.team ?? ""}
                </button>
                <button
                  type="button"
                  className={styles.ptabX}
                  aria-label={`Close ${player2.name}`}
                  onClick={() => {
                    onCloseTab(id);
                  }}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
        <span className={styles.scoringnote}>follows {fmtLabel}</span>
        <button
          type="button"
          className={styles.close}
          aria-label="Close player card"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className={styles.body}>
        <CardHeader
          model={model}
          playerId={active}
          onTeamFilter={onTeamFilter}
        />

        <nav
          className={styles.secnav}
          role="tablist"
          aria-label="Card sections"
        >
          {/* section tabs swap content below; the header above stays put */}
          {SECTIONS.map((sectionName) => (
            <button
              key={sectionName}
              type="button"
              role="tab"
              aria-selected={section === sectionName}
              className={`${styles.secbtn} ${section === sectionName ? styles.secbtnOn : ""}`}
              onClick={() => {
                setSection(sectionName);
              }}
            >
              {sectionName}
            </button>
          ))}
        </nav>

        <div className={styles.grid}>
          <div>
            {section === "Overview" && (
              <Overview model={model} playerId={active} range={range} />
            )}
            {section === "Game log" && (
              <GameLog
                playerId={active}
                season={logSeason}
                onSeason={setLogSeason}
              />
            )}
            {section === "Splits" && <Splits playerId={active} />}
            {section === "Trends" && <Trends playerId={active} />}
            {section === "History" && <History playerId={active} />}
          </div>
          <aside>
            <div className={styles.newscard}>
              <div
                className="nh"
                style={{
                  padding: "10px 12px",
                  borderBottom: "1px solid var(--line)",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text-2)",
                }}
              >
                Latest news · status only
              </div>
              <div className={styles.nbody}>
                {player.injuryStatus
                  ? `${player.name} is ${
                      player.injuryStatus === "Q"
                        ? "questionable"
                        : player.injuryStatus === "O"
                          ? "out"
                          : "on injured reserve"
                    }${player.practiceStatus ? ` (practice: ${player.practiceStatus.toLowerCase()})` : ""}.`
                  : "No status to report. A real news feed arrives in a later phase from a separate provider."}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </Modal>
  );
}

/** Hero + bio + rankings + status row (player spec §6.1). */
function CardHeader({
  model,
  playerId,
  onTeamFilter,
}: {
  model: SeasonModel;
  playerId: string;
  onTeamFilter: (team: string) => void;
}) {
  const player = model.playerById.get(playerId);
  if (!player) return null;
  const team = player.team ? model.teamsByAbbr.get(player.team) : null;
  // header facts: next matchup, ranks and status all come from the model
  const next = matchup(model, player.team, player.position, model.currentWeek);
  const posRank = model.seasonRank.get(player.id);
  const ovRank = model.overallRank.get(player.id);
  const isIdp = ["DB", "LB", "DL"].includes(player.position);
  const ht =
    player.heightIn != null
      ? `${String(Math.floor(player.heightIn / 12))}'${String(player.heightIn % 12)}"`
      : null;
  const draft =
    player.draftRound && player.draftYear
      ? `${String(player.draftYear)} R${String(player.draftRound)} #${String(player.draftPick ?? 0)}`
      : player.draftYear
        ? `${String(player.draftYear)} Undrafted`
        : null;
  const statusWord =
    player.injuryStatus === "Q"
      ? "Questionable"
      : player.injuryStatus === "O"
        ? "Out"
        : player.injuryStatus === "IR"
          ? "Injured reserve"
          : "Active";

  // DEF cards show team facts; player cards show the bio strip
  const bio: [string, string][] =
    player.position === "DEF"
      ? [
          ["TEAM", team?.name ?? "—"],
          ["DIVISION", team?.division ?? "—"],
          ["STADIUM", team?.stadium ?? "—"],
        ]
      : [
          ["AGE", player.age != null ? String(player.age) : null],
          ["HT", ht],
          [
            "WT",
            player.weightLb != null ? `${String(player.weightLb)} lb` : null,
          ],
          [
            "EXP",
            player.yearsExp === 0
              ? "Rookie"
              : player.yearsExp != null
                ? `${String(player.yearsExp)} yr`
                : null,
          ],
          ["COLLEGE", player.college],
          ["DRAFT", draft],
        ].filter((x): x is [string, string] => x[1] != null);

  return (
    <>
      <div className={styles.hero}>
        <Avatar name={player.name} id={player.id} size={72} />
        <div className={styles.heroName}>
          <h2>{player.name}</h2>
          <div className={styles.heroSub}>
            <PosTag pos={player.position} />
            <span>
              {player.team ?? "FA"}
              {player.jerseyNumber != null
                ? ` · #${String(player.jerseyNumber)}`
                : ""}
            </span>
          </div>
        </div>
        <div className={styles.heroActs}>
          <button
            type="button"
            className={styles.iconbtn}
            disabled
            title="Watchlist — arrives in a later phase"
          >
            ★
          </button>
          <button
            type="button"
            className={`${styles.iconbtn} ${styles.addbtn}`}
            disabled
            title="Add to roster — needs a connected league (later phase)"
          >
            ADD soon
          </button>
        </div>
      </div>

      <div className={styles.biostrip}>
        {bio.map(([k, v]) => (
          <span key={k} className={styles.bi}>
            <span className={styles.bl}>{k}</span>
            <span className={styles.bv}>{v}</span>
          </span>
        ))}
      </div>

      <div className={styles.rankstrip}>
        <div className={styles.rk}>
          <div className={`${styles.rv} num`}>
            {posRank ? `#${String(posRank)}` : "—"}
          </div>
          <div className={styles.rl}>{player.position} RANK · est</div>
        </div>
        <div className={styles.rk}>
          <div className={`${styles.rv} num`}>
            {ovRank ? `#${String(ovRank)}` : "—"}
          </div>
          <div className={styles.rl}>{isIdp ? "IDP" : "OVERALL"} · est</div>
        </div>
        <div
          className={styles.rk}
          title="Needs a connected league — later phase"
        >
          <div className={`${styles.rv} ${styles.rvStub}`}>—</div>
          <div className={styles.rl}>% ROSTERED</div>
        </div>
        <div
          className={styles.rk}
          title="Needs a connected league — later phase"
        >
          <div className={`${styles.rv} ${styles.rvStub}`}>—</div>
          <div className={styles.rl}>% STARTED</div>
        </div>
      </div>

      <div className={styles.statusRow}>
        <span
          className={`${styles.statusbar} ${
            player.injuryStatus === "Q"
              ? styles.sbQ
              : player.injuryStatus === "O"
                ? styles.sbO
                : player.injuryStatus === "IR"
                  ? styles.sbIR
                  : ""
          }`}
        >
          <span className="k">Status</span> {statusWord}
        </span>
        {player.practiceStatus && (
          <span className={styles.statusbar}>
            <span className="k">Practice</span> {player.practiceStatus}
          </span>
        )}
        <span className={styles.statusbar}>
          <span className="k">Week {model.currentWeek}</span>{" "}
          {next ? (
            <>
              vs {next.opponent} <MatchChip matchup={next} />
            </>
          ) : (
            "Bye"
          )}
        </span>
        {player.team && (
          <button
            type="button"
            className={styles.teamlink}
            onClick={() => {
              onTeamFilter(player.team ?? "");
            }}
          >
            → {team?.name ?? player.team}
          </button>
        )}
      </div>
    </>
  );
}
