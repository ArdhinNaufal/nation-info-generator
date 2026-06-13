# CLAUDE.md — nation-info-generator

> Keep this file **lean**. It is paid for at the start of *every* session. A bloated
> CLAUDE.md doesn't just waste budget — it makes the model ignore your actual rules.
> Pruning test for every line: *"Would removing this cause the agent to make mistakes?"*
> If not, cut it. (Anti-bloat is a load-bearing rule, not a style preference.)

## What this project is

nation-info-generator — a client-side web app (Vite + React + TS, no backend) that turns a
country into a downloadable, fully customizable **wallpaper PNG** of its facts. See `SPEC.md`.

## The workflow (every task runs this loop)

```
SPECIFY → PLAN → EXECUTE → VERIFY → RECORD
   ↑                                   |
   └──────────── learnings feed back ──┘
```

- **SPECIFY** a feature into `specs/<feature>.md` via the spec-interview skill before coding.
- **PLAN** in plan mode for anything spanning multiple files or unfamiliar code. Skip the
  plan only if you could describe the diff in one sentence.
- **EXECUTE** against the plan. Front-load the full task in the first message.
- **VERIFY** with something the model can't talk around (a test, a script, a diff). Demand
  **evidence, not assertions** — show the command and its output. See `.claude/skills/verify/`.
- **RECORD** what was learned: append gotchas to `learnings/`, update `todos/`.

## Environment mechanics

<!-- Fill these in once the stack is chosen. Commands the agent CANNOT guess go here. -->
- Install:    TODO(stack)
- Build:      TODO(stack)
- Test (all): TODO(stack)
- Test (one): TODO(stack)   <!-- the single-file test command is high-value; the agent can't guess it -->
- Lint/format: TODO(stack)
- Run locally: TODO(stack)

## Universally-true rules

- **Verifiers over memory.** Every constraint worth keeping lives in `CRITICAL-RULES.md`
  with a check that enforces it. If a rule keeps getting violated, strengthen its verifier
  (or delete this file's clutter so the rule stops drowning) — don't just add emphasis.
- **No secrets in context or git.** Never paste production secrets into a session or commit
  them. Use env vars; document required ones here, not their values.
- **New session per unrelated task.** Don't let one window accumulate corrections. Corrected
  the agent twice on the same issue? The context is poisoned — clear and re-prompt with the
  learning written down.

## Context layer (where knowledge lives — one job each)

- `CLAUDE.md`        — this file: environment mechanics + universally-true rules (lean).
- `MEMORY.md`        — project knowledge the code can't tell you.
- `CRITICAL-RULES.md`— bare constraints, each backed by a named verifier.
- `SPEC.md` / `specs/` — what is being built, per feature.
- `learnings/`       — gotchas discovered the hard way (append-only).
- `todos/`           — persistent task state: active / backlog / completed.
- `.claude/skills/`  — on-demand expertise (verify, spec-interview), one job each.
- `.claude/agents/`  — subagent definitions (fresh-context reviewer).
- `.claude/settings.json` — permissions + hooks.

@MEMORY.md
@CRITICAL-RULES.md
