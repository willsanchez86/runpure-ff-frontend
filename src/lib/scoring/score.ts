/** Fantasy-point scoring from a raw stat line (ADR-0007; Player explorer PRD
 * scoring switch; Overview shared terms for IDP and DEF). Pure function —
 * the whole page recomputes from it when the scoring switch changes. */
import type { StatLine } from "@/lib/api/contract";
import type { ScoringConfig } from "./types";

/** Points for one played week under a scoring config (prototype math). */
export function score(line: StatLine, cfg: ScoringConfig): number {
  switch (line.position) {
    case "K":
      return line.fgMade * 3 + line.fg50Plus * 2 + line.xpMade - line.fgMissed;
    case "DEF": {
      const pa = line.pointsAllowed;
      // DEF points-allowed tiers: shutout 10 → 35+ allowed −4
      const paPts =
        pa === 0
          ? 10
          : pa < 7
            ? 7
            : pa < 14
              ? 4
              : pa < 21
                ? 1
                : pa < 28
                  ? 0
                  : pa < 35
                    ? -1
                    : -4;
      return (
        paPts +
        line.sacks +
        line.interceptions * 2 +
        line.fumbleRecoveries * 2 +
        line.tds * 6 +
        line.safeties * 2
      );
    }
    case "DB":
    case "LB":
    case "DL":
      // Overview shared terms: default IDP scoring.
      return (
        line.soloTackles * 1 +
        line.assistTackles * 0.5 +
        line.sacks * 2 +
        line.interceptions * 3 +
        line.passesDefended * 1 +
        line.forcedFumbles * 2 +
        line.fumbleRecoveries * 2 +
        line.tds * 6 +
        line.tacklesForLoss * 0.5
      );
    default: {
      // the scoring switch: full/half/zero points per reception
      const receptionPts = cfg.fmt === "ppr" ? 1 : cfg.fmt === "half" ? 0.5 : 0;
      const tePremium = line.position === "TE" && cfg.tePrem ? 0.5 : 0;
      const passing =
        line.position === "QB"
          ? line.passYards * 0.04 +
            line.passTds * (cfg.ptd6 ? 6 : 4) -
            line.interceptions * 2
          : 0;
      const rushing =
        line.rushYards * 0.1 +
        (line.position === "QB" || line.position === "RB"
          ? line.rushTds * 6
          : 0);
      const receiving =
        line.position === "RB" ||
        line.position === "WR" ||
        line.position === "TE"
          ? line.receptions * (receptionPts + tePremium) +
            line.recYards * 0.1 +
            line.recTds * 6
          : 0;
      const fumbles = line.fumbles * 2;
      return Math.round((passing + rushing + receiving - fumbles) * 100) / 100;
    }
  }
}
