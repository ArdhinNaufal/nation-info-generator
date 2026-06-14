# specs/poster-mode.md — Nation Poster Mode

> Status: **specified** (2026-06-14). Produced via spec-interview.
> Implement in a **fresh session** containing only this spec + CLAUDE.md.
>
> **Amendment (2026-06-14):** the landmark name/description, photo-search query, and facts are
> now **typed by the user** in a "Poster content" form, not fetched from Claude. Only the photo
> (Unsplash), map (Geoapify), and GDP (World Bank) are fetched. References to the Anthropic /
> Claude step below are superseded by the manual form — kept for historical context.

---

## 1. Goal

Add a **Poster Mode** tab to the nation-info-generator. It generates a magazine-style
portrait poster for any country — landmark photo background, map snapshot, AI-written facts
— as a downloadable PNG. The existing Classic/Sidebar/Grid/Minimal generator is unchanged.

Users: anyone who wants a rich, visually-striking country poster, not just a fact sheet.

---

## 2. Visual layout (pixel-precise reference)

The canvas is divided into two vertical zones.

### 2a. Upper section (~50% of canvas height)

Two sub-columns inside a dark-translucent panel (a gap separates the far-left vertical-text
strip from the content column so the rotated text doesn't crowd the flag/stats):

**Left sub-column** (≈40% of canvas width):
- Country flag image (top, aspect ratio preserved, ≈38% of left-column width)
- Stacked fact rows (each: bold label, value below) — top-to-bottom order:
  - **GDP** — `$486 billion` (formatted: `$X.X trillion` or `$X billion`)
  - **GDP Per Capita, PPP** — `$104,460` (formatted: `$X,XXX`)
  - **Population** — `5,519,594` (locale-formatted integer)
  - **Area** — `323,802 SQ.KM` (locale-formatted integer + ` SQ.KM`)
  - **Currency** (`Ccy:` prefix, shorter label) — currency name only (no symbol)
- Along the **far-left edge**: vertical text (bottom-to-top rotation) showing the
  landmark **name** in bold, followed by an em-dash and a one-sentence description.
  Text is rotated 90° counter-clockwise. It **wraps onto a second line** in the strip
  rather than truncating; only past two lines is it clipped with an ellipsis.

**Right sub-column** (≈60% of canvas width):
- Country **name** — large, bold, white, top-right
- **Map snapshot** image — rectangular, fills most of the right column width
- Below the map, two columns of short facts (right-aligned labels, bold values):
  - Left cell: `Region:` + bold region name
  - Right cell: `Capital:` + bold capital name
  - Below those: `Off. Lang.:` + official language name(s). This value (and the left
    column's `Ccy` value) **wraps onto further lines** rather than clipping — both are
    the last item in their column, so there is room.

### 2b. Lower section (~50% of canvas height)

Vertically stacked **prose fact cards**. Each card:
- Slight black-translucent background (same style as upper panel but per-card)
- Single paragraph of white text — one of the 7 AI-generated facts
- Cards fill from top; stop when space runs out (max 7 facts, fewer may render)

### 2c. Global style rules

- **Background:** the landmark photograph fills the entire canvas; cover-cropped.
- **All text:** white (`#ffffff`)
- **Panels:** `rgba(0, 0, 0, 0.45)` fill; no border
- **Photographer credit:** bottom-right corner of canvas, small white text:
  `Photo by {name} on Unsplash`
- No theme-color customization in poster mode (the dark-photo aesthetic is fixed)

---

## 3. Data pipeline per country

One generation run performs these fetches in parallel where possible:

| Step | Service | Key? | What we get |
|------|---------|------|-------------|
| 1 | REST Countries v5 (already wired) | Yes (env) | Flag URL, capital, population, area, region, subregion, languages, currencies, lat/lng |
| 2 | World Bank API | No | GDP (`NY.GDP.MKTP.CD`) and GDP per capita PPP (`NY.GDP.PCAP.PP.CD`) — most recent year |
| 3 | **User input** (Poster content form) | — | Landmark name, landmark description, Unsplash search query, up to 7 facts (one per line). Facts pre-filled from REST Countries fields as a starting point. |
| 4 | Unsplash API | User-supplied | One photo matching the user's search query (largest available size); photographer name+link for attribution |
| 5 | Geoapify Static Maps | User-supplied | PNG map image centered on country lat/lng, OSM-carto style, country boundaries naturally rendered |

The user fills the content form (step 3), then clicks **Generate poster**. Steps 2, 4, 5 fire
on Generate: World Bank (2) and Unsplash (4) run in parallel; Unsplash uses the query from the
form. A cache hit on country resolve renders immediately and skips all of these.

---

## 4. API endpoints

### World Bank
```
GET https://api.worldbank.org/v2/country/{alpha2_lower}/indicator/{INDICATOR}?format=json&mrv=1
```
- CORS-enabled, no key.
- `data[1][0].value` is the most recent value (may be `null` for small territories).
- If `null` or request fails → omit that stat from the poster (show nothing in that slot).

### Poster content (manual)
No API. The user types these in the "Poster content" form; they are stored in the cache record
verbatim and rendered directly:
- `landmarkName` — the iconic landmark (drives the left-edge vertical text).
- `landmarkDescription` — one sentence shown after the landmark name.
- `unsplashQuery` — the photo search string (blank → fall back to `{nameCommon} landscape`).
- `facts` — one per line, up to 7 (blank → field-based facts from REST Countries).

### Unsplash
```
GET https://api.unsplash.com/search/photos?query={encodedQuery}&per_page=1&orientation=portrait
Headers: Authorization: Client-ID {userKey}
```
Use `results[0]`: `urls.regular` for the canvas image, `user.name` for attribution.
If no results → retry with `{nameCommon} landscape` query. Still nothing → solid dark
gradient background (no photo).

### Geoapify Static Maps
```
GET https://maps.geoapify.com/v1/staticmap
  ?style=osm-carto
  &width={mapWidth}
  &height={mapHeight}
  &center=lonlat:{lng},{lat}
  &zoom={zoom}
  &apiKey={userKey}
```
Zoom heuristic based on country area (km²):
- area > 3,000,000 → zoom 3
- area > 500,000  → zoom 4
- area > 50,000   → zoom 5
- area > 5,000    → zoom 6
- else            → zoom 7

If request fails → render the map slot as a solid dark rectangle with text
`Map unavailable`.

---

## 5. API key management

**Settings screen** — accessible via a gear icon / "Settings" link visible in Poster Mode.
Two fields: Unsplash Access Key, Geoapify API Key. (No Anthropic key — the landmark/facts are
typed by the user.)
- Keys are saved to `localStorage` under keys `poster_key_unsplash`, `poster_key_geoapify`.
- A **"Clear all keys"** button wipes all three.
- Settings screen also shows which keys are present (masked) vs missing.
- If a key is missing when generation is triggered → show an inline error directing the
  user to Settings. Do not attempt the call with an empty key.

World Bank requires no key.

---

## 6. Caching

Generated poster data is persisted to `localStorage` keyed by `poster_cache_{alpha2}`.

Cached record shape:
```ts
interface PosterCache {
  alpha2: string;
  landmarkName: string;
  landmarkDescription: string;
  unsplashQuery: string;
  facts: string[];
  photographerName: string;
  photographerUrl: string;
  unsplashPhotoUrl: string;   // urls.regular
  geoapifyUrl: string;        // full static map URL
  gdp: number | null;
  gdpPerCapitaPpp: number | null;
  generatedAt: number;        // Date.now()
}
```
- On country resolve: check cache first. If cache hit → skip steps 2–5 and render
  immediately from cache.
- Cache never expires automatically (user can regenerate manually).
- **Regenerate button**: clears the `poster_cache_{alpha2}` entry and re-runs the pipeline.

---

## 7. Generation trigger

- On country resolve: a **cache hit** fills the form + renders immediately; a **miss** pre-fills
  the content form (starter facts) and waits for the user.
- The user clicks **Generate poster** to fetch the photo/map/GDP and render. The button also
  serves as Regenerate (it clears this country's cache and re-runs from the current form).
- Show a **loading skeleton** (grey placeholder rectangles in the poster layout) while the
  fetches are in flight.
- Once the fetches complete (or gracefully degrade), render the final poster.

---

## 8. Graceful degradation (per section)

| Section | API | Fallback |
|---------|-----|---------|
| Background photo | Unsplash | Solid `rgba(20,20,20,1)` with no attribution line |
| Map | Geoapify | Dark rectangle + `Map unavailable` in white |
| Landmark text / facts | User input | Blank landmark → no vertical text; empty facts box → field-based facts from REST Countries |
| GDP / GDP Per Capita | World Bank | Omit those stat rows from the left column; remaining stats shift up |
| Photographer credit | Unsplash | Omit the credit line |

Show a non-blocking warning banner above the poster when degradation occurs:
`Some content is unavailable — check your API keys or try Regenerate.`

---

## 9. Output sizes

Poster mode reuses the **existing size presets** (Desktop 1920×1080, 4K 3840×2160,
Mobile 1080×1920, Square 1080×1080, Tablet 1536×2048, Custom). The layout adapts
proportionally. Portrait presets (Mobile, Tablet) best match the reference image.

The Geoapify map is requested at the **exact pixel size of its render slot**
(`render/poster#mapSlotSize`) so its aspect matches and the renderer can draw it *contained*
(never cropped) — the whole fetched territory always shows. REST Countries provides no bounding
box, so `zoomForArea` is biased one step wider than a tight fit; elongated nations (e.g. Norway)
then sit fully in frame with neighbours visible.

**Text size:** two sliders (0.70–1.60×) scale the upper-section text and the fact-card text
independently. They re-render live without re-fetching images.

**Preview zoom:** the result card has a view-only zoom (0.5–4×, −/%/+); the canvas scales inside
a scrollable wrapper. This affects the on-screen preview only — the exported PNG is always at the
selected output size.

---

## 10. Render architecture

```
src/render/poster.ts          — pure render(ctx, PosterInput, size) function
                                (RenderTarget interface, testable with recording fake)
src/services/worldbank.ts     — fetchGdp(alpha2): Promise<{gdp, gdpPpp}>
src/services/unsplashService.ts — fetchPhoto(query, key): Promise<UnsplashPhoto>
src/services/geoapifyService.ts — buildMapUrl(lat, lng, area, mapW, mapH, key): string
src/state/posterCache.ts      — getPosterCache / setPosterCache / clearPosterCache
src/state/keyStore.ts         — getKeys / setKeys / clearKeys (localStorage)
src/components/PosterMode.tsx — orchestrates fetches, cache, loading state, regenerate
src/components/KeySettings.tsx — settings screen / modal
src/components/PosterPreview.tsx — canvas element + download button for poster
```

`render/poster.ts` must satisfy the same `RenderTarget` interface as `render/wallpaper.ts`.
The `PosterInput` type:
```ts
interface PosterInput {
  country: Country;
  landmarkName: string;
  landmarkDescription: string;
  facts: string[];
  gdp: number | null;
  gdpPerCapitaPpp: number | null;
  backgroundImage?: CanvasImageSource;     // Unsplash photo
  mapImage?: CanvasImageSource;            // Geoapify PNG
  photographerName?: string;
  borderNames?: string[];
}
```

---

## 11. Out of scope (explicit)

- No drag-and-drop or free positioning of poster elements.
- No theme-color / font-family / field-toggle customization in poster mode (fixed style).
  (Two text-**size** sliders — upper section and facts — are allowed.)
- No server/backend — all calls go directly from the browser (user is responsible for their keys).
- No sharing, cloud sync, or URL-based permalinks.
- No animated/video output.
- The existing Classic/Sidebar/Grid/Minimal mode is **not modified** by this feature.
- Country GeoJSON overlay (true choropleth highlighting) — out of scope; standard OSM
  basemap with natural boundary rendering is sufficient.

---

## 12. End-to-end verification

Steps the owner can judge personally (no code reading required):

1. **Settings flow**: Open Poster Mode → click Settings → enter Unsplash and Geoapify keys →
   save → masked keys appear in Settings → return to poster.

2. **Generation happy path**: Enter `Norway` → fill the Poster content form (landmark, one-line
   description, photo query, facts) → click Generate poster → upper section shows flag, GDP,
   population, area, currency, the landmark vertical text you typed, map, region, capital,
   language → lower section shows your facts (≤7) → background is the Unsplash photo for your
   query → photographer credit appears bottom-right.

3. **Cache hit**: Switch to a different country, then switch back to `Norway` →
   poster + form repopulate immediately without any loading state (no new API calls fired).

4. **Regenerate**: Edit the content or query → click Generate poster → loading skeleton appears
   → new Unsplash photo + your edited text rendered → cache updated.

5. **Degradation — bad Unsplash key**: Set Unsplash key to `bad` → generate any country →
   background is solid dark, no photo, no credit → warning banner shown → other sections
   (map, facts) render normally.

6. **Degradation — small territory, no GDP**: Generate `Bouvet Island` (`BV`) → GDP and
   GDP per capita rows are absent from the left column (World Bank returns null) → no
   blank/zero row appears → remaining stats shift up.

7. **Download**: Click download on a generated poster → PNG file saved → open it →
   dimensions match the selected size preset.

8. **Existing mode unaffected**: Switch to the existing generator tab → enter a country →
   Classic/Sidebar/Grid/Minimal layouts render as before, with no regression.

9. **Test suite**: `bash .claude/skills/verify/scripts/check.sh` passes (lint + tests).
   `test/poster.render.test.ts` tests `render/poster.ts` offline (recording fake ctx, no live
   API calls) covering: landmark text drawn, fact count ≤ 7, GDP formatted correctly, missing
   GDP renders no blank row. `test/posterState.test.ts` covers the two-key store + cache.
