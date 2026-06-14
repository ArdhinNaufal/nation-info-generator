# Active todos

> Persistent task state survives sessions; conversation does not. Keep the current work here.
> Move items to `completed.md` when done (with the evidence/commit), to `backlog.md` if deferred.

## Poster Mode — specified, ready to build (`specs/poster-mode.md`)

> Build in a **fresh session** seeded with only `specs/poster-mode.md` + `CLAUDE.md`.
> Suggested order (each step is independently testable; services are pure/DI'd so they
> follow the existing offline-fixture pattern — CRITICAL-RULES #3).

### Services / data (pure, fixture-testable)
- [ ] `src/services/worldbank.ts` — `fetchGdp(alpha2)` → `{gdp, gdpPpp}` (keyless; null on miss)
- [ ] `src/services/claudePoster.ts` — `fetchPosterContent(country, key)` → landmark name +
      description + unsplash query + 7 facts; parse JSON, degrade on failure
- [ ] `src/services/unsplashService.ts` — `fetchPhoto(query, key)` → photo url + photographer
- [ ] `src/services/geoapifyService.ts` — `buildMapUrl(lat,lng,area,w,h,key)` (zoom heuristic by area)

### State
- [ ] `src/state/keyStore.ts` — get/set/clear the 3 user keys in localStorage
- [ ] `src/state/posterCache.ts` — get/set/clear `poster_cache_{alpha2}` (`PosterCache` shape)

### Render (pure, recording-fake testable)
- [ ] `src/render/poster.ts` — `render(ctx, PosterInput, size)` against the shared `RenderTarget`
      interface: photo bg + translucent panels, upper 2-column (flag/stats/vertical landmark
      text | name/map/region·capital·lang), lower prose-fact cards (≤7), photographer credit

### UI / orchestration
- [ ] `src/components/KeySettings.tsx` — settings screen: 3 key fields (masked), clear-all
- [ ] `src/components/PosterMode.tsx` — tab orchestrator: resolve → cache check → parallel
      fetches → loading skeleton → graceful degradation banner → Regenerate
- [ ] `src/components/PosterPreview.tsx` — canvas + download (reuse existing size presets)
- [ ] Wire a mode/tab switch in `App.tsx` (existing generator must stay unmodified)

### Verify
- [ ] `test/poster.render.test.ts` — offline: landmark text drawn, facts ≤ 7, GDP formatting,
      missing-GDP renders no blank row
- [ ] Run `bash .claude/skills/verify/scripts/check.sh` → must be green
- [ ] Manual E2E pass per spec §12 (settings → generate Norway → cache hit → regenerate →
      degradation cases → download dims → existing mode unaffected)

## Carry-over (pre-existing)
- [ ] Manual browser pass: confirm a real PNG downloads at exact preset/custom dimensions and
      images render without tainting the canvas (offline tests can't exercise `toBlob`).
