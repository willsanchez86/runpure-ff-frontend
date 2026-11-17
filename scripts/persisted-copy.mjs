/**
 * Copies the generated persisted-documents manifest into the backend repo's
 * trusted-documents store (ADR-0016 item 3; ADR-0017 item 9). Ship both repos'
 * changes in the same change set; the backend deploys first.
 * Usage: node scripts/persisted-copy.mjs [path-to-backend-repo]
 */
import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const backend =
  process.argv[2] ?? process.env.RUNPURE_BACKEND_DIR ?? "../runpure-ff-backend";
const src = "generated/persisted-documents.json";
if (!existsSync(src)) {
  console.error(`${src} not found — run \`npm run codegen\` first.`);
  process.exit(1);
}
const dest = join(backend, "persisted", "frontend.json");
copyFileSync(src, dest);
console.log(`Copied ${src} -> ${dest}`);
