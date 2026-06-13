# SPEC.md — nation-info-generator

> **Status: not yet specified.** The product is intentionally undecided. Run the spec
> interview (below) in a dedicated session to produce a real spec, then **start a fresh
> session to build it** — the interview context should not come along; the build session
> should contain only the distilled spec.
>
> Per-feature specs live in `specs/<feature>.md`. This file holds the top-level product spec.

## How to produce this spec (§4.1 — the most teachable step in the workflow)

Paste this into a fresh session (or invoke the `spec-interview` skill):

```
I want to build nation-info-generator: [one-paragraph description of what it does and who
uses it]. Interview me in detail using the AskUserQuestion tool. Ask about technical
implementation, UI/UX, edge cases, concerns, and tradeoffs. Don't ask obvious questions —
dig into the hard parts I might not have considered. Keep interviewing until we've covered
everything, then write a complete spec to SPEC.md.
```

A good interview will force decisions only you can make. For this project, expect:
- **Surface:** CLI, library, HTTP API, web UI — or several? (Reshapes the architecture.)
- **Data source of truth:** bundled dataset vs. live API; which one; licensing; freshness.
- **Identifier:** ISO 3166-1 alpha-2 / alpha-3 / name — pick one canonical key.
- **Output shape:** which fields, what format (JSON / text / table), localization.
- **Out of scope (state it explicitly):** a spec that doesn't say what's *out* grows until it dies.

## Spec template (fill via the interview)

### 1. Goal
TODO — one or two sentences: what it does and for whom.

### 2. In scope
TODO — bullet list.

### 3. Out of scope
TODO — bullet list. Be explicit; this is what keeps the build bounded.

### 4. Interfaces & files
TODO — the entry points, modules, and data shapes involved.

### 5. Data
TODO — source of truth, identifier, fields stored/returned, refresh story.

### 6. Edge cases
TODO — disputed entities, missing data, ambiguous input, etc.

## Verification (end-to-end) — non-negotiable

A spec ends with checks the owner can personally judge. Replace with real steps once defined:

```
1. Given <input>, the tool produces <expected output> — assert exact values, not just "it ran".
2. Given an unknown/invalid nation, it fails clearly (defined error), not silently.
3. Run the test suite (.claude/skills/verify/) and show the passing output.
```
