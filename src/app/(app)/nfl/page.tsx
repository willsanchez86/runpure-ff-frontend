/** /nfl — NFL scores and schedule (specs/ff-nfl-scores-and-schedule-spec.md). */
import { NflScreen } from "@/features/nfl/NflScreen";

/** Auth-gated and fully client-dynamic: nothing renders until the session
 * resolves, so Next's instant-navigation prevalidation cannot apply here. */
export const instant = false;

/** NFL route. */
export default function NflPage() {
  return <NflScreen />;
}
