# Canvas wallpaper export

## A cross-origin flag image silently taints the canvas → toBlob throws
- **Date:** 2026-06-13
- **Symptom:** drawing the flag onto the canvas works, but `canvas.toBlob()` throws a
  `SecurityError` ("tainted canvas") and the PNG download fails.
- **Cause:** images loaded from another origin (flagcdn) taint the canvas unless requested
  with CORS. Drawing succeeds; *exporting* is what fails.
- **Rule:** set `img.crossOrigin = 'anonymous'` before `img.src` (flagcdn sends CORS headers).
  See `src/render/export.ts: loadFlagImage`. If a flag ever fails to load, it resolves to
  `undefined` and the wallpaper renders without it (never block generation — SPEC §7).

## Make the renderer pure so it's testable offline
- **Date:** 2026-06-13
- **Rule:** `render(ctx, input)` takes a `RenderTarget` (structural subset of
  `CanvasRenderingContext2D`), not a real canvas. Tests pass a recording fake that captures
  `fillText` calls, so we assert on the actual drawn values (capital, population, …) with no
  DOM/canvas — satisfies SPEC §8.2 + CRITICAL-RULES #3 (offline). Gotcha: the fake's
  `measureText` must parse px from font strings like `"700 76px Inter"` (regex `/(\d+)px/`),
  not `parseInt`, or wrapping math goes wrong and word-wrapped values fail substring asserts.
