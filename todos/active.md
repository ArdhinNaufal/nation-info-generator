# Active todos

> Persistent task state survives sessions; conversation does not. Keep the current work here.
> Move items to `completed.md` when done (with the evidence/commit), to `backlog.md` if deferred.

## Poster Mode — BUILT (`specs/poster-mode.md`); see completed.md

> Remaining is the manual browser E2E only (offline tests can't exercise live APIs / `toBlob`):
- [ ] Manual E2E per spec §12: Settings → enter the 3 keys → generate `Norway` (flag, GDP,
      population, area, currency, landmark vertical text, map, region/capital/language; 7 fact
      cards; photographer credit) → switch away and back = instant cache hit → Regenerate =
      new photo/text → bad Unsplash key = solid bg + warning → `Bouvet Island` = no GDP rows →
      download = PNG at the chosen dimensions → Wallpaper tab still renders all 4 layouts.

## Carry-over (pre-existing)
- [ ] Manual browser pass: confirm a real PNG downloads at exact preset/custom dimensions and
      images render without tainting the canvas (offline tests can't exercise `toBlob`).
