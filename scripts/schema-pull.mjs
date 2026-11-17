/**
 * Copies the backend's committed schema.graphql into this repo (ADR-0016 item 2;
 * foundation spec P5). The copy is committed so type generation is reviewable.
 * Usage: node scripts/schema-pull.mjs [path-to-backend-repo]
 */
import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const backend =
  process.argv[2] ?? process.env.RUNPURE_BACKEND_DIR ?? "../runpure-ff-backend";
const src = join(backend, "schema.graphql");
if (!existsSync(src)) {
  console.error(
    `schema.graphql not found at ${src} — pass the backend repo path or set RUNPURE_BACKEND_DIR.`,
  );
  process.exit(1);
}
copyFileSync(src, "schema.graphql");
console.log(`Copied ${src} -> schema.graphql`);
