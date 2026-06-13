# MEMORY.md — project knowledge

> What a new senior developer would need to know that the code does **not** say:
> implicit invariants, why decisions were made, what's load-bearing and undocumented.
> This is distinct from `CLAUDE.md` (environment mechanics) and `CRITICAL-RULES.md`
> (constraints with verifiers). Grow it as decisions are made — in a greenfield project
> every convention is one session old, so record it *when it is decided*.

## Architecture

TODO(spec): emerges from the §4.1 interview. Record the stack, the major modules, and the
data flow once chosen. Reference patterns by file ("follow the pattern in X") rather than
re-describing them.

## Domain knowledge (nation / country data)

Decisions to capture as they're made:
- Data source(s) of truth for nation facts (bundled dataset? external API? which one?).
- Canonical identifier for a nation (ISO 3166-1 alpha-2? alpha-3? name?) — pick one and
  note why; mismatched identifiers are a classic source of bugs.
- How disputed / non-standard entities are handled (territories, observers, historical states).
- Freshness: how/when underlying data is refreshed, and what "correct as of" means.

## Decisions log (newest first)

- 2026-06-13 — Product specified (see SPEC.md). Client-side Vite + React + TS SPA, no backend.
  Generates a downloadable wallpaper PNG of a country's facts via Canvas. Data: live REST
  Countries v3.1 (no key, CORS); canonical id = ISO alpha-2, input accepts name/alpha-2/alpha-3.
  Customization v1 = theme presets + color overrides + font selection + per-field show/hide +
  layout presets (NOT drag-and-drop). Saved designs in localStorage. Tests run offline on fixtures.
- 2026-06-13 — Adopted the AI-SDLC workflow scaffold (convergent architecture, §4.7).
  Product intentionally undecided; to be specified via the spec interview.
