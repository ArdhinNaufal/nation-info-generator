# Completed

> Doubles as an audit trail of AI-assisted work. Record the item and how it was verified.

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
