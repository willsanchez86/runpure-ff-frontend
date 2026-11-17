/**
 * Fails if src/styles/tokens.css has drifted from the planning repo's
 * design/tokens.css (foundation spec P4: verbatim copy + provenance header).
 * Usage: node scripts/check-tokens.mjs <path-to-planning-repo-checkout>
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const planningDir = process.argv[2];
if (!planningDir) {
  console.error("Usage: node scripts/check-tokens.mjs <planning-repo-path>");
  process.exit(2);
}

const normalize = (s) => s.replace(/\r\n/g, "\n").trimEnd();
const source = normalize(
  readFileSync(join(planningDir, "design", "tokens.css"), "utf8"),
);
const copy = normalize(readFileSync("src/styles/tokens.css", "utf8"));

if (!copy.includes(source)) {
  console.error(
    "src/styles/tokens.css no longer contains the planning repo's design/tokens.css verbatim.\n" +
      "Re-copy it (keep the provenance header) — tokens change in the planning repo first.",
  );
  process.exit(1);
}
console.log("tokens.css matches the planning repo.");
