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

- 2026-06-14 — **Poster Mode — manual map zoom.** Replaced the auto-fit map zoom with a
  user-controlled **"Map zoom" slider (1–12)** whose value is captured at Generate and baked into
  the Geoapify URL (`buildMapUrlAt`). The map is still **centered** on the geocoded bbox
  (`fetchCountryBbox` → `bboxCenter`) — falling back to the REST Countries centroid — but the zoom
  is no longer computed. `mapZoom` is persisted in `PosterCache` (optional) and restored on a
  cache hit; it persists across countries on a miss (like the text-size sliders). Removed the now
  obsolete `zoomForArea`/`buildMapUrl`/`zoomForBbox`/`buildMapUrlFromBbox` and their tests; added
  `bboxCenter`/`buildMapUrlAt` tests. 61 tests.

- 2026-06-14 — **Poster Mode tuning pass (5) — container-fitted map zoom.** Once the map
  cover-fills its slot, Geoapify's `area=rect:` fit was cropping the long axis, so the bbox URL
  builder switched to **center + a zoom computed from the bbox and the container** (`zoomForBbox`,
  Web-Mercator, picks the smaller of the lon-fit / lat-fit zooms, +10% margin) centered on the
  box. The zoom now follows the map image container, so the territory fits *and* fills. Default
  upper text scale 0.70→0.75 and `UPPER_FRACTION` 0.40→0.43 (taller upper panel for the larger
  text). 67 tests (added `zoomForBbox`; rewrote the `buildMapUrlFromBbox` cases to center+zoom).

- 2026-06-14 — **Poster Mode tuning pass (4).** Default upper text scale 0.85→0.70 and
  `UPPER_FRACTION` 0.45→0.40 (shorter upper panel → more fact space). Map now **cover-fills** its
  slot (`drawCover`) instead of contain — safe because the `area=rect:` bbox fit frames the whole
  country inside the slot-aspect image, so fill crops nothing. Removed the now-unused
  `drawContainCentered`. The landmark-wrap test label was shortened so it still spans two lines in
  the (shorter) strip. 64 tests.

- 2026-06-14 — **Poster Mode tuning pass (3) — exact map fit + smaller defaults.** The
  centroid+zoom heuristic kept clipping tall nations, so the map now **geocodes the country's
  bounding box** (`fetchCountryBbox` → Geoapify geocoding, *same key* as the static map) and
  requests `area=rect:lon1,lat1,lon2,lat2` (`buildMapUrlFromBbox`, +6% pad) for an exact fit;
  `zoomForArea`/`buildMapUrl` remain as the fallback when the geocode fails. bbox fetch joins the
  GDP/Unsplash `Promise.all`. Default text scales lowered (upper 0.85×, facts 0.70×) and
  `UPPER_FRACTION` 0.50→0.45 to match the more compact upper text and give facts more room. 64
  tests (added `buildMapUrlFromBbox` cases; `fetchCountryBbox` is network-only, untested per
  CRITICAL-RULES #3). Caveat: a country's geocoded bbox can include far-flung territory (e.g. an
  overseas region) and over-zoom the mainland — acceptable for now; note it if it surfaces.

- 2026-06-14 — **Poster Mode tuning pass (2).** (1) `zoomForArea` biased one *more* step wider
  (Norway→3) — the prior bias still clipped tall nations because the map slot is landscape-ish and
  REST Countries' centroid sits south of the far north; neighbours showing is acceptable per the
  user. (2) Added `VGAP_U` (a gap between the vertical landmark strip and the content column) so
  the rotated text no longer crowds the flag/stats. (3) `UPPER_FRACTION` 0.55→0.50 — the upper
  panel is shorter, giving the fact cards more height. (4) `PosterPreview` gained a view-only
  **zoom control** (0.5–4×, −/%/+ buttons): the canvas scales via inline `max-width`/`max-height`
  inside a `.poster-canvas-scroll` (overflow:auto) wrapper, so zooming in pans without touching
  the canvas pixel resolution or the PNG export. Geometry constants live at the top of
  `render/poster.ts`; `mapSlotSize`/`renderPoster` share `upperGeometry`. 62 tests.

- 2026-06-14 — **Poster Mode layout + readability pass.** (1) The whole page is now
  non-scrolling: `.app` is a `100vh` flex column with `overflow:hidden`; only the left settings
  column (`.layout > div:nth-child(1)`) scrolls; the preview is capped at `calc(100vh - 240px)`.
  A `<900px` media query relaxes back to normal scroll. (2) Renderer text no longer clips where
  there's room: the rotated landmark label wraps to **2 lines** (ellipsis only past 2), and the
  `Ccy` value + `Off. Lang.` value **wrap** (they're last in their column). (3) Map: requested at
  the **exact slot size** (`mapSlotSize`, single geometry source shared with `renderPoster`) and
  drawn **contained** (never cropped); `zoomForArea` biased one step wider (Norway→4) since REST
  Countries gives no bbox. (4) Two **font-size sliders** (`upperFontScale`/`factsFontScale`,
  0.70–1.60×) scale upper vs fact text. `PosterPreview` now decodes images in one effect and
  draws in another, so slider/text tweaks redraw without re-fetching the flag/photo/map. 62 tests.

- 2026-06-14 — **Dropped the browser-direct Claude call from Poster Mode**; the landmark
  name/description, photo-search query, and facts are now **typed by the user** in a "Poster
  content" form (`PosterMode.tsx`). Deleted `services/claudePoster.ts` and the `anthropic` key
  (`keyStore` is now Unsplash + Geoapify only). Flow changed from "auto-generate on resolve" to
  "fill the form → **Generate poster**" (the button doubles as Regenerate: clears this country's
  cache, re-fetches photo/map/GDP from the current form). Facts textarea pre-fills with
  field-based facts as a starting point; a cache hit on resolve repopulates the form + renders
  instantly. `PosterCache` shape unchanged (the text fields are now user-entered, not Claude).
  Renderer (`render/poster.ts`) and `PosterPreview` untouched. 50 tests (key store now asserts
  two keys). The §11 "no secrets" posture improves: no AI key leaves the browser at all now.

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
