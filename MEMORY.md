# MEMORY.md — project knowledge

> What a new senior developer would need to know that the code does **not** say:
> implicit invariants, why decisions were made, what's load-bearing and undocumented.
> This is distinct from `CLAUDE.md` (environment mechanics) and `CRITICAL-RULES.md`
> (constraints with verifiers). Grow it as decisions are made — in a greenfield project
> every convention is one session old, so record it *when it is decided*.

## Architecture

Vite + React + TS SPA. Data flow: `App.tsx` creates a `CountryApi` (`data/countries.ts`) and
holds UI state (resolved country, border names, customization, size, saved designs). Input →
`CountryInput` (async resolve) → `Controls` (customization/size) → `CanvasPreview` (render +
PNG download). `SavedDesigns` persists to localStorage.

**No `/all`.** We deliberately avoid `restcountries.com/v3.1/all` (heavy, throttled; its error
responses omit CORS headers, which browsers misreport as a "CORS policy" failure). Resolution
uses the per-resource endpoints via a DI'd `CountryApi` (`byAlpha` / `byName` / `byCodes`), so
the shipped `resolveCountry(query, api)` logic is the logic tested offline (tests inject a
fixture-backed fake). Dev calls go through a Vite proxy (`/rc` → restcountries, see
`vite.config.ts`) to dodge localhost CORS; prod calls the CORS-enabled endpoints directly
(`API_BASE` switches on `import.meta.env.DEV`).

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

- 2026-06-14 — Built **Poster Mode** (`specs/poster-mode.md`): a second tab generating a
  magazine-style portrait poster (landmark-photo background, flag + World-Bank GDP stats, map
  snapshot, Claude-written facts). Render is a pure `renderPoster(ctx, PosterInput, size)` in
  `render/poster.ts` whose `PosterTarget` *extends* the wallpaper `RenderTarget` (adds
  `translate`/`rotate`/`createLinearGradient` for vertical landmark text + the no-photo
  gradient) — same recording-fake test seam. Services (`services/{worldbank,claudePoster,
  unsplashService,geoapifyService}`) are thin `fetch` wrappers; only the keyless World Bank one
  and the pure `geoapify` URL builder are deterministic. Keys (`state/keyStore`) + per-country
  cache (`state/posterCache`) are DI'd `StorageLike` like `state/storage`, so they're tested
  offline. Claude is called **directly from the browser** with the user's key (model
  `claude-sonnet-4-6`, the spec's choice) — requires the
  `anthropic-dangerous-direct-browser-access: true` header or the request is CORS-blocked.
  Degradation is per-section (§8): a missing key skips that call (never sent empty) and shows an
  inline "add it in Settings" banner; API failures fall back (field-based facts / solid bg /
  "Map unavailable"). Async generation is guarded by a monotonic run-id so rapid country
  switches can't render one country's data under another. Wallpaper mode is untouched. 50 tests.

- 2026-06-14 — Dropped the `/v3.1/all` fetch after it failed with a CORS error in the browser
  (its throttled/error responses carry no `Access-Control-Allow-Origin`). Switched to per-query
  endpoints (`/alpha`, `/name`, `/alpha?codes=`) behind a DI'd `CountryApi`; resolution is now
  async. Added a Vite dev proxy (`/rc`) for localhost; prod hits the endpoints directly. Cost:
  "did-you-mean" suggestions on a no-match are dropped (no full list to fuzzy-match against) —
  acceptable per the user. 30 tests passing (resolution rewritten to inject a fixture fake).
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
