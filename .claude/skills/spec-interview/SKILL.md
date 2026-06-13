---
name: spec-interview
description: >-
  Run a structured spec interview before building a feature, and write the result to SPEC.md
  or specs/<feature>.md. Load when starting a new feature, when the user says "spec this out",
  "interview me", "let's design", or when a request is vague enough that building now would
  guess at requirements. Do NOT use for trivial one-sentence changes (skip the spec — just do it).
---

# spec-interview

Turns a rough idea into a precise, self-contained spec. Time spent here pays off more than
time spent watching the implementation — and for non-code-reading owners, the spec is the
*only* place a wrong implementation can be caught.

## Procedure

1. Confirm a one-paragraph description of the feature and who uses it.
2. Interview with the **AskUserQuestion** tool. Cover technical implementation, UI/UX, edge
   cases, concerns, tradeoffs. **Don't ask obvious questions** — dig into the hard parts the
   owner might not have considered. Batch related questions. Keep going until genuinely covered.
3. Write a complete spec to `SPEC.md` (top-level product) or `specs/<feature>.md` (per feature).

## The spec must be self-contained

- Names the files / interfaces / data shapes involved.
- States what is **out of scope**, explicitly.
- Ends with an **end-to-end verification** step the owner can personally judge
  (input → expected output; for UI, a screenshot/recording of the flow).

## Then: fresh session to build

The interview window is full of meandering context. **Start a new session to implement**, so
the build context contains only the distilled spec.

## Project-specific hard questions to force (nation data)

- Surface: CLI / library / HTTP API / web UI — which, and why?
- Source of truth for nation facts; licensing; how/when it refreshes.
- Canonical identifier (ISO 3166-1 alpha-2 vs alpha-3 vs name) — pick one.
- Handling of disputed / non-standard / historical entities.
- Output fields and format; localization.
