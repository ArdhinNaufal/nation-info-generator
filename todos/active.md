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

## Poster Mode layout/readability pass — verify visually
- [ ] Non-scroll layout: the page itself never scrolls; only the left settings column scrolls;
      the poster preview fits within the viewport (no clipping below the fold). Narrow window
      (<900px) falls back to normal scrolling.
- [ ] Long landmark name+description wraps to 2 lines in the left strip (ellipsis only if longer);
      a long currency name and a long Off. Lang. list wrap instead of showing `…`.
- [ ] Map shows the full territory (try `Norway`, `Chile`, `Russia`); nothing cropped.
- [ ] Upper/Facts text-size sliders rescale the right text live and do NOT re-fetch the photo
      (network tab shows no new image requests while dragging).

## Carry-over (pre-existing)
- [ ] Manual browser pass: confirm a real PNG downloads at exact preset/custom dimensions and
      images render without tainting the canvas (offline tests can't exercise `toBlob`).
