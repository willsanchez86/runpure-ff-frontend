/** /players — the Player explorer (specs/ff-player-explorer-spec.md). */
import { Suspense } from "react";
import { PlayersScreen } from "@/features/players/PlayersScreen";

/** Players route; Suspense wraps useSearchParams (?team= deep link, P1). */
export default function PlayersPage() {
  return (
    <Suspense>
      <PlayersScreen />
    </Suspense>
  );
}
