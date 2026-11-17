# Rules for agents in this repo

1. Build only what a PRD and spec on `runpure-ff-planning` `main` describe. Never copy planning documents here; link to them. This repo implements: `specs/ff-frontend-foundation-spec.md`, `specs/ff-player-explorer-spec.md`, `specs/ff-nfl-scores-and-schedule-spec.md`.
2. Every pull request fills in `Implements:` with the PRD, spec and ADR paths it carries out.
3. Before an ADR's first implementing code merges, its planning-repo file must have an **Implementation started** line.
4. Never commit with `--no-verify`. Never push to `main`; open a pull request.
5. Comments (owner, 2026-11-17): a JSDoc comment on every exported function, type and constant (what it does, plus any constraint a caller must know); one header comment per module naming the spec section or ADR it implements; short inline comments describing the logic throughout — clear and concise, never excessive. `npm run lint` checks the JSDoc.
6. `src/styles/tokens.css` is a verbatim copy of the planning repo's `design/tokens.css` plus a provenance header. Never edit it here; tokens change in the planning repo first (CI enforces the match).
7. Names and conditionals (owner, 2026-11-17): descriptive identifiers — no single-letter variables, parameters or properties (exceptions: `_`-prefixed deliberate discards; the DOM's own attribute names). Explain an abbreviated or non-obvious name once, where it is declared; prefer a rename over a comment. Guard clauses (early returns) are the preferred conditional style.

---

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
