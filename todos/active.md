# Active todos

> Persistent task state survives sessions; conversation does not. Keep the current work here.
> Move items to `completed.md` when done (with the evidence/commit), to `backlog.md` if deferred.

## Poster Mode — BUILT (`specs/poster-mode.md`); see completed.md

> Remaining is the manual browser E2E only (offline tests can't exercise live APIs / `toBlob`):
> NOTE: landmark/facts are now a user-typed form (no Claude); only Unsplash + Geoapify keys.
- [ ] Manual E2E per spec §12: Settings → enter Unsplash + Geoapify keys → resolve `Norway` →
      fill the Poster content form (landmark, description, photo query, facts) → Generate poster
      (flag, GDP, population, area, currency, landmark vertical text, map, region/capital/
      language; fact cards ≤7; photographer credit) → switch away and back = instant cache hit
      (form + poster repopulate) → edit + Generate = new photo/text → bad Unsplash key = solid
      bg + warning → `Bouvet Island` = no GDP rows → download = PNG at the chosen dimensions →
      Wallpaper tab still renders all 4 layouts.

## Carry-over (pre-existing)
- [ ] Manual browser pass: confirm a real PNG downloads at exact preset/custom dimensions and
      images render without tainting the canvas (offline tests can't exercise `toBlob`).
