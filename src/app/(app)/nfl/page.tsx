/** /nfl — placeholder until the NFL scores and schedule slice lands
 * (specs/ff-nfl-scores-and-schedule-spec.md; foundation spec §13 step 6). */
import { ScreenPlaceholder } from "@/components/shell/ScreenPlaceholder";

/** NFL screen placeholder. */
export default function NflPage() {
  return (
    <ScreenPlaceholder
      title="NFL"
      sub="Scores and schedule, by week."
      note="The week picker, game cards and byes arrive with the NFL scores and schedule build."
    />
  );
}
