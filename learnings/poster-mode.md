# Poster Mode (specs/poster-mode.md)

## Calling Anthropic directly from the browser needs an explicit opt-in header
- **Date:** 2026-06-14
- **Symptom:** `POST https://api.anthropic.com/v1/messages` from the browser fails with a CORS
  error even with a valid `x-api-key`.
- **Cause:** Anthropic blocks direct browser calls by default (it expects calls from a server).
- **Rule:** send `anthropic-dangerous-direct-browser-access: true` alongside `x-api-key` and
  `anthropic-version`. See `services/claudePoster.ts`. This is acceptable here only because the
  app is explicitly user-keyed and client-side (spec §11) — the user owns the key.

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

## Async generation must be guarded against rapid country switches
- **Date:** 2026-06-14
- **Symptom (caught in review, pre-merge):** switch country mid-pipeline and the slow run's
  `setRecord` lands after the new country is shown — flag from country B, facts/photo/map from
  country A. A silent 200-that-lies, no error.
- **Rule:** `PosterMode` bumps a monotonic `runIdRef` at the start of each `generate` (and on a
  cache hit); every `await` boundary bails if `runIdRef.current` moved on. Any auto-generating,
  cancel-on-change effect needs this — React effect cleanup alone doesn't stop an in-flight
  promise chain.
