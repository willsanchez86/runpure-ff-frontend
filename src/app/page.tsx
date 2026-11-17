/** / — the app opens on the Players screen (foundation spec §2 routes, P1). */
import { redirect } from "next/navigation";

/** Permanent entry redirect. */
export default function Home() {
  redirect("/players");
}
