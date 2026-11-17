/** /players — placeholder until the Player explorer slice lands
 * (specs/ff-player-explorer-spec.md; foundation spec §13 step 5). */
import { ScreenPlaceholder } from "@/components/shell/ScreenPlaceholder";

/** Players screen placeholder. */
export default function PlayersPage() {
  return (
    <ScreenPlaceholder
      title="Players"
      sub="Every NFL player, refreshed daily."
      note="The player table arrives with the Player explorer build (table, filters, scoring switch, player card, compare)."
    />
  );
}
