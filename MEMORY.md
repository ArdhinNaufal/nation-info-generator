# MEMORY.md — project knowledge

> What a new senior developer would need to know that the code does **not** say:
> implicit invariants, why decisions were made, what's load-bearing and undocumented.
> This is distinct from `CLAUDE.md` (environment mechanics) and `CRITICAL-RULES.md`
> (constraints with verifiers). Grow it as decisions are made — in a greenfield project
> every convention is one session old, so record it *when it is decided*.

## Architecture

Vite + React + TS SPA. Data flow: `App.tsx` fetches the full country list once
(`data/countries.ts`), holds all UI state (resolved country, customization, size, saved
designs). Input → `CountryInput` (resolve) → `Controls` (customization/size) → `CanvasPreview`
(render + PNG download). `SavedDesigns` persists to localStorage.

Load-bearing seam: **rendering is a pure function** `render(ctx, input)` in
`render/wallpaper.ts` that draws onto any `RenderTarget` (a structural subset of
`CanvasRenderingContext2D`). This is why render is testable offline — tests pass a recording
fake ctx and assert on captured `fillText` strings (see `test/render.test.ts`). Don't move
canvas/DOM construction into this module.

Other pure (tested) modules: `data/countries.ts` (`normalizeCountry`, `resolveCountry`),
`render/sizes.ts` (`validateCustomSize`), `state/storage.ts` (DI'd `StorageLike` so tests use
an in-memory fake). Browser-only glue (`toBlob`, image load, download) lives in
`render/export.ts`; only its pure `prepareCanvas` is tested.

## Domain knowledge (nation / country data)

Decisions to capture as they're made:
- Data source(s) of truth for nation facts (bundled dataset? external API? which one?).
- Canonical identifier for a nation (ISO 3166-1 alpha-2? alpha-3? name?) — pick one and
  note why; mismatched identifiers are a classic source of bugs.
- How disputed / non-standard entities are handled (territories, observers, historical states).
- Freshness: how/when underlying data is refreshed, and what "correct as of" means.

## Decisions log (newest first)

- 2026-06-13 — Built v1. Resolved the spec's open items: **fonts** = Inter/Lora/Montserrat/
  JetBrains Mono (bundled via `@fontsource`, + 0.7–1.6× size scale); **layouts** = Classic,
  Sidebar, Grid, Minimal (Minimal shows only capital/population/region); **size presets** =
  Desktop 1920×1080, 4K 3840×2160, Mobile 1080×1920, Square 1080×1080, Tablet 1536×2048, +
  custom (bounds 64–8000px/side, ≤40M px). Theme presets: Light/Dark/Midnight/Sepia/Forest
  (Dark default). Tests: vitest, 27 cases, offline fixtures; flag is loaded with
  `crossOrigin='anonymous'` (flagcdn allows CORS) so the canvas stays untainted for `toBlob`.
- 2026-06-13 — Product specified (see SPEC.md). Client-side Vite + React + TS SPA, no backend.
  Generates a downloadable wallpaper PNG of a country's facts via Canvas. Data: live REST
  Countries v3.1 (no key, CORS); canonical id = ISO alpha-2, input accepts name/alpha-2/alpha-3.
  Customization v1 = theme presets + color overrides + font selection + per-field show/hide +
  layout presets (NOT drag-and-drop). Saved designs in localStorage. Tests run offline on fixtures.
- 2026-06-13 — Adopted the AI-SDLC workflow scaffold (convergent architecture, §4.7).
  Product intentionally undecided; to be specified via the spec interview.
