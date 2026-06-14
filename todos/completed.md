# Completed

> Doubles as an audit trail of AI-assisted work. Record the item and how it was verified.

- [x] 2026-06-14 — Poster Mode layout + readability pass. Page is now non-scrolling (only the
      left settings column scrolls; preview capped to the viewport; `<900px` relaxes to normal
      flow). Renderer: rotated landmark label wraps to 2 lines (ellipsis only past 2); `Ccy` and
      `Off. Lang.` values wrap instead of clipping. Map requested at the exact render-slot size
      (`mapSlotSize`) and drawn contained (never cropped); `zoomForArea` biased one step wider so
      elongated nations sit fully in frame. Added two font-size sliders (upper vs facts) via
      `upperFontScale`/`factsFontScale`; `PosterPreview` split into decode-effect + draw-effect so
      slider/text tweaks redraw without re-fetching images. Verified:
      `bash .claude/skills/verify/scripts/check.sh` → PASS (`tsc --noEmit` clean + 62 vitest
      cases: +landmark/Ccy/lang wrap, +font scales, +mapSlotSize, +geoapify zoom/url) and
      `npm run build` succeeds. Manual browser E2E (non-scroll layout + visual fit) remains.

- [x] 2026-06-14 — Built Poster Mode (`specs/poster-mode.md`): new "Poster" tab generating a
      magazine-style portrait poster — landmark-photo background, flag + World Bank GDP stats,
      Geoapify map, Claude-written facts. New: pure `render/poster.ts` (`PosterTarget extends`
      the wallpaper `RenderTarget`), `services/{worldbank,claudePoster,unsplashService,
      geoapifyService}`, DI'd `state/{keyStore,posterCache}`, `components/{PosterMode,
      KeySettings,PosterPreview}`, `render/export.ts#loadImage`, App tab switch. Per-section
      graceful degradation (§8); missing keys skip the call + show an inline Settings prompt
      (§5); per-country cache (§6); regenerate; run-id guard against rapid-switch races
      (fresh-context review found that one pre-merge). Claude called browser-direct with the
      user's key (`claude-sonnet-4-6` + `anthropic-dangerous-direct-browser-access`). Verified:
      `bash .claude/skills/verify/scripts/check.sh` → RESULT: PASS (`tsc --noEmit` clean + 50
      vitest cases offline: poster render §12.9 + key/cache state) and `npm run build` succeeds.
      Wallpaper mode unchanged. Manual browser E2E (spec §12) remains — see active.md.

- [x] 2026-06-14 — Specified Poster Mode (`specs/poster-mode.md`) via spec-interview: a
      photo-backed magazine poster as a separate tab. Decided data sources (World Bank GDP,
      Claude `claude-sonnet-4-6` for landmark+facts, Unsplash photo, Geoapify map),
      user-supplied keys in a settings screen, localStorage caching, per-section graceful
      degradation. Ready to build in a fresh session. Tasks broken out in `active.md`.

- [x] 2026-06-14 — Migrated REST Countries v3.1 → v5 after `api.restcountries.com` began
      requiring auth. Added `Authorization: Bearer` (key in `.env.local`,
      `VITE_RESTCOUNTRIES_API_KEY`), rewrote `RawCountry`/`normalizeCountry` for the v5
      response shape (`data.objects[]`, `names`/`codes`/`capitals`/`flag`/`area`/`links`),
      switched `createCountryApi` to `?q=&limit=100` with client-side code filtering (v5 has
      no code endpoint), updated the Vite proxy + fixtures. Fixed flag CORS by building
      `flagPng` from flagcdn.com (CORS-OK) instead of the v5 CDN. Verified: `tsc --noEmit`
      clean + 30 vitest cases passing offline; live key smoke-tested via curl.

- [x] 2026-06-13 — Built nation-info-generator v1 per SPEC.md. Vite+React+TS SPA: country
      resolution (name/alpha-2/alpha-3 → alpha-2), pure canvas renderer, 4 layout presets,
      5 themes + color/font/size customization, per-field toggles, 5 size presets + validated
      custom size, localStorage saved designs. Verified: `bash
      .claude/skills/verify/scripts/check.sh` → RESULT: PASS (`tsc --noEmit` clean + 27 vitest
      cases passing, offline against `test/fixtures/`); `npm run build` succeeds. Covers SPEC
      §8.1–8.5 + 8.7. §8.6 (unresolved input) covered by resolution tests; full browser PNG
      download is a manual step (see active.md).

- [x] 2026-06-13 — Scaffolded the AI-SDLC convergent architecture (§4.7): context layer
      (CLAUDE.md / MEMORY.md / CRITICAL-RULES.md / SPEC.md / specs/), learnings/, todos/,
      and `.claude/` (verify + spec-interview skills, reviewer agent, settings + SessionStart
      hook). Verified: files present and the SessionStart hook runs cleanly.
