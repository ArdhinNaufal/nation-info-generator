# SPEC.md — nation-info-generator

> Status: **specified** (2026-06-13). Produced via the spec-interview skill.
> Build this in a **fresh session** containing only this spec — not the interview context.
> Per-feature specs live in `specs/<feature>.md`; this is the top-level product spec.

## 1. Goal

A browser app where a user enters a country, picks a size and styling, and downloads a
**wallpaper image** showing that nation's facts. Fully client-side — no backend, no accounts.
For anyone who wants a good-looking, fact-filled wallpaper of a specific country.

## 2. In scope

- **Country input** accepting any of: common name, official name, ISO 3166-1 alpha-2, or
  alpha-3. Normalized internally to **alpha-2** (the canonical key).
- **Fact display + wallpaper generation** covering all field groups (see §5).
- **Wallpaper rendering** to a PNG via HTML Canvas, fully client-side.
- **Output sizes:** built-in presets **and** a custom width×height.
- **Customization (v1):**
  - Theme presets (e.g. light / dark / flag-tinted).
  - Color overrides (background / text / accent) via color pickers.
  - Font selection (family from a bundled set + size).
  - Per-field show/hide toggles (choose which facts appear).
  - **Layout presets** — a small set of fixed layout templates the user chooses between.
- **Saved designs** persisted to browser **localStorage** (country + full customization),
  reopenable across visits on the same device.

## 3. Out of scope (explicit — keeps the build bounded)

- **Free drag-and-drop / free positioning** of elements. Layout is preset-only in v1.
- Any **backend, server, accounts, or auth**.
- **Sharing via URL** or cloud sync (localStorage is device-local; revisit in a later spec).
- **Animated / video** wallpapers; multi-country collages.
- **UI localization** — the app UI is English in v1 (country *data* may include native names).
- A **bundled offline production dataset** — production uses the live API; offline fixtures
  exist only for tests (§ CRITICAL-RULES #3).
- **Historical / dissolved states** — only entities the live API returns are supported.

## 4. Surface & stack

- **Client-side SPA**, no server. **Vite + React + TypeScript.**
- Rendering of the wallpaper via the **Canvas 2D API**; export with `canvas.toBlob()` → PNG download.
- State (selected country, customization, saved designs) held in React state + `localStorage`.

## 5. Data

- **Source of truth:** live **REST Countries v3.1** (`https://restcountries.com/v3.1`),
  called directly from the browser. No API key; CORS-enabled. Attribute the source in the UI.
- **Canonical identifier:** ISO 3166-1 **alpha-2** (`cca2`). Input by name/alpha-2/alpha-3 is
  resolved to alpha-2 before fetching/caching.
- **Fields used (grouped):**
  - *Core:* common & official name, capital, population, area, region, subregion.
  - *Names / languages / currency:* native names, languages, currencies.
  - *Flag / geo / borders:* flag image, lat/lng (latlng), bordering countries, maps link.
- **Freshness:** whatever the live API returns at fetch time; responses may be cached
  in-memory for the session to avoid refetching. "Correct as of" = time of fetch.
- **Tests** must not hit the live API — they run against **bundled JSON fixtures** captured
  from REST Countries (offline, deterministic).

## 6. Interfaces & files (planned — confirm/adjust at build time)

```
index.html
src/
  main.tsx                  app entry
  App.tsx                   layout: input → controls → canvas preview → download
  data/
    countries.ts            fetch + normalize REST Countries; resolve any id → alpha-2
    types.ts                Country, Customization, SavedDesign types
  render/
    wallpaper.ts            pure render(ctx, country, customization, size) → draws to canvas
    layouts.ts              layout-preset definitions
    sizes.ts                size presets + custom-size validation
  state/
    storage.ts              load/save designs to localStorage
  components/
    CountryInput.tsx, Controls.tsx, CanvasPreview.tsx, SavedDesigns.tsx
test/
  fixtures/                 captured REST Countries JSON (offline)
  *.test.ts                 resolution, render, storage, edge cases
```

## 7. Edge cases

- **Unresolved input** (typo, unknown name/code): show a clear inline error with
  suggestions; **never** generate a broken or empty wallpaper. (Dominant rule.)
- **Missing field** in the API response: **omit** that field from the wallpaper — never
  render `undefined`/blank. Layout adapts to the fields actually present.
- **Ambiguous name** matching several countries: present the matches for the user to pick;
  do not silently choose one.
- **Custom size** out of sane bounds (e.g. ≤0 or absurdly large): validate and reject with a
  message before rendering.
- **localStorage unavailable/full:** degrade gracefully — app still works, saving is disabled
  with a notice.
- **Network/API failure:** surface a retryable error; don't crash the app.

## 8. Verification (end-to-end) — non-negotiable

Steps the owner can personally judge (input → expected output, not "it ran"):

1. **Resolution:** entering `Japan`, `JP`, and `JPN` each resolve to the same country
   (alpha-2 `JP`) and populate identical facts. *(test + manual)*
2. **Render correctness:** generating a wallpaper for a known country (against a fixture)
   produces a PNG containing the expected facts (capital, population, etc.); assert the
   render function draws the expected text/values, not just that it returned a canvas.
3. **Customization:** toggling a field off removes it from the output; changing theme/colors/
   font changes the rendered result; choosing a different layout preset rearranges it.
4. **Sizes:** a preset and a valid custom size each export a PNG of exactly the chosen
   dimensions; an invalid custom size is rejected with a clear message.
5. **Saved designs:** saving a design, reloading the page, and reopening it restores the
   country + all customization from localStorage.
6. **Unresolved input** (`Atlantis`) shows the defined error + suggestions and generates
   nothing.
7. Run the test suite (`.claude/skills/verify/` → `scripts/check.sh`) and show passing output.
   Tests run **offline** against fixtures (no live API).
