# Poster Mode (specs/poster-mode.md)

## Calling Anthropic directly from the browser needs an explicit opt-in header (SUPERSEDED)
- **Date:** 2026-06-14
- **Status:** **Superseded** later the same day — Poster Mode no longer calls Claude; the
  landmark/facts are typed by the user (`services/claudePoster.ts` deleted). Kept as a reference
  for anyone who reintroduces a browser-direct Anthropic call.
- **Symptom:** `POST https://api.anthropic.com/v1/messages` from the browser fails with a CORS
  error even with a valid `x-api-key`.
- **Cause:** Anthropic blocks direct browser calls by default (it expects calls from a server).
- **Rule:** send `anthropic-dangerous-direct-browser-access: true` alongside `x-api-key` and
  `anthropic-version`. This is acceptable only because the app is explicitly user-keyed and
  client-side (spec §11) — the user owns the key.

## Extend the shared RenderTarget instead of forking it
- **Date:** 2026-06-14
- **Rule:** the poster needs `translate`/`rotate` (vertical landmark text) and
  `createLinearGradient` (no-photo fallback) that the wallpaper `RenderTarget` lacks. Define
  `PosterTarget extends RenderTarget` in `render/poster.ts` rather than a separate interface —
  a real `CanvasRenderingContext2D` still satisfies it, and the recording fake just adds those
  methods. Keeps both renderers testable with the same offline pattern (CRITICAL-RULES #3).
- **Gotcha:** in the recording-fake `measureText`, read the font from the captured `ctx`
  variable, not `this.font` — under the `as unknown as PosterTarget` cast, `this` loses its type
  and `tsc` errors on `this.font`.

## Cover-cropping an image in a pure renderer needs the image's intrinsic size
- **Date:** 2026-06-14
- **Rule:** `drawCover`/`drawContain` read `naturalWidth`/`naturalHeight` (falling back to
  `videoWidth`/`width`) off the `CanvasImageSource` to compute the scale. Tests never pass real
  images (the slots degrade to gradient / "Map unavailable"), so this path is browser-only; keep
  the dimension read defensive so an unexpected source type can't throw mid-render.

## Geoapify static maps can't "fit a country" without a bounding box
- **Date:** 2026-06-14
- **Symptom:** a center+zoom map cut off elongated countries (Norway) — the territory ran past
  the frame top/bottom or sides.
- **Cause(s):** two compounding ones. (a) The map was *requested* at one aspect (0.4W×0.3H) but
  *drawn* into a differently-shaped slot, and `drawCover` crops the overflow. (b) A fixed
  area→zoom table ignores the map's pixel width, so the same area can over- or under-fill.
- **Fix:** one geometry source (`upperGeometry` → `mapSlotSize`) so the request matches the slot
  exactly; draw the map **contained** (centered, never cropped) over a dark backing; and bias
  `zoomForArea` one step wider. REST Countries (v5) exposes only `latlng` (centroid) + `area`, no
  bbox — so a *perfect* fit isn't possible client-side; the wider bias trades some empty margin
  (neighbours visible) for never clipping the country. If a bbox source is added later, switch to
  Geoapify's `area=rect:lon1,lat1,lon2,lat2` for an exact fit.

## Decode images and draw in *separate* effects so render-only tweaks don't refetch
- **Date:** 2026-06-14
- **Rule:** `PosterPreview` loads the flag/photo/map in an effect keyed on the image URLs, stores
  the decoded `CanvasImageSource`s in state, and draws in a second effect keyed on
  `[decoded, input, size]`. The font-size sliders change `input` only, so they redraw instantly
  without re-fetching images. Memoize `images` (URLs) in the parent on `[country, record]` so its
  identity is stable across slider/text changes, or the load effect re-runs anyway.

## Async generation must be guarded against rapid country switches
- **Date:** 2026-06-14
- **Symptom (caught in review, pre-merge):** switch country mid-pipeline and the slow run's
  `setRecord` lands after the new country is shown — flag from country B, facts/photo/map from
  country A. A silent 200-that-lies, no error.
- **Rule:** `PosterMode` bumps a monotonic `runIdRef` at the start of each `generate` (and on a
  cache hit); every `await` boundary bails if `runIdRef.current` moved on. Any auto-generating,
  cancel-on-change effect needs this — React effect cleanup alone doesn't stop an in-flight
  promise chain.
