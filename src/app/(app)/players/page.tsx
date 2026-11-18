/** /players — the Player explorer (specs/ff-player-explorer-spec.md). */
import { Suspense } from "react";
import { PlayersScreen } from "@/features/players/PlayersScreen";

/** Auth-gated and fully client-dynamic: nothing renders until the session
 * resolves, so Next's instant-navigation prevalidation cannot apply here. */
export const instant = false;

/** Players route; Suspense wraps useSearchParams (?team= deep link, P1). */
export default function PlayersPage() {
  return (
    <Suspense>
      <PlayersScreen />
    </Suspense>
  );
}
