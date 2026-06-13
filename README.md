# nation-info-generator

A project scaffolded with the **AI-SDLC workflow** — a reproducible loop for building
software with AI agents, where trust comes from verifiers and knowledge lives in versioned
files, not in conversation.

> **Product status:** intentionally undecided. The scaffold is in place; the actual product
> is produced by running the spec interview (see below). Until then, command placeholders in
> `CLAUDE.md` are marked `TODO(stack)`.

## The workflow

```
SPECIFY → PLAN → EXECUTE → VERIFY → RECORD
   ↑                                   |
   └──────────── learnings feed back ──┘
```

1. **Specify** — interview before building. Run the `spec-interview` skill; it writes a
   self-contained spec to `SPEC.md` / `specs/<feature>.md` ending with checks you can judge.
   Then build in a **fresh** session containing only the spec.
2. **Plan** — use plan mode for multi-file or unfamiliar work; skip it if the diff is one sentence.
3. **Execute** — front-load the full task; build against the plan.
4. **Verify** — gate "done" on evidence, not assertions. Run the `verify` skill
   (`.claude/skills/verify/scripts/check.sh`); use the `code-reviewer` agent for independent,
   fresh-context review at milestones.
5. **Record** — append gotchas to `learnings/`; keep task state in `todos/`.

## Layout (the convergent architecture)

| Path | Job |
|------|-----|
| `CLAUDE.md` | Environment mechanics + universally-true rules. Kept lean. |
| `MEMORY.md` | Project knowledge the code can't tell you. |
| `CRITICAL-RULES.md` | Bare constraints, each backed by a named verifier. |
| `SPEC.md` / `specs/` | What's being built. Start with the spec interview. |
| `learnings/` | Gotchas discovered the hard way (append-only). |
| `todos/` | Persistent task state: active / backlog / completed. |
| `.claude/skills/` | On-demand expertise: `verify`, `spec-interview`. |
| `.claude/agents/` | `code-reviewer` — fresh-context independent review. |
| `.claude/hooks/` + `settings.json` | SessionStart hook (workflow context + dep install). |

## Getting started

1. Run the spec interview to decide what the generator does and its stack:
   *invoke the `spec-interview` skill, or paste the template in `SPEC.md`.*
2. Fill the `TODO(stack)` commands in `CLAUDE.md` and wire the real lint/test commands into
   `.claude/skills/verify/scripts/check.sh`.
3. Build the first feature in a fresh session, gated by `verify`.

Two principles underpin all of it: **context is the scarce resource — spend it deliberately**,
and **trust comes from verifiers, not from the model**.
