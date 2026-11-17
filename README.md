# runpure-ff-frontend

Fantasy Workbench — the Next.js frontend for Runpure FF Phase 1: the Player
explorer and the NFL scores and schedule screens, on nflverse data refreshed
daily by the backend.

All planning lives in [`runpure-ff-planning`](https://github.com/willsanchez86/runpure-ff-planning)
(PRDs, specs, ADRs, design language). This repo implements:

- `specs/ff-frontend-foundation-spec.md` — architecture, configs, shell
- `specs/ff-player-explorer-spec.md` — Players screen, player card, compare
- `specs/ff-nfl-scores-and-schedule-spec.md` — NFL screen

Rules for contributors and agents: [`AGENTS.md`](AGENTS.md).

## Develop

```
npm ci          # install (Node >= 24)
npm run dev     # dev server
npm test        # vitest
npm run lint    # eslint (incl. JSDoc rule)
npm run build   # production build
```

CI (`verify` in `.github/workflows/quality.yml`) runs format:check, lint,
typecheck, test and build on every PR; `security-baseline` audits production
dependencies; `planning-refs` checks PR `Implements:` paths and tokens.css drift.
