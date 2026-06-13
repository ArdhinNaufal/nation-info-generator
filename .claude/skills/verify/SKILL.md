---
name: verify
description: >-
  Verification for nation-info-generator — run the project's checks and prove a change works
  with evidence, not assertions. Load when finishing a task, before declaring "done", when
  asked to verify/test/confirm a change, or before merging. Bundles a deterministic check
  script. Do NOT use for writing new feature code or for one-off exploratory questions.
---

# verify

Verification skill. The category with the highest measured impact on output quality, so it is
the **first** skill in this project. The job: gate every "done" on evidence the owner can
judge.

## How to verify (in order)

1. **Run the check script** and capture its output:
   ```
   .claude/skills/verify/scripts/check.sh
   ```
   It runs the project's lint + test commands. Until the stack is chosen it is a stub that
   exits non-zero and tells you what to wire up — that is intentional: an empty project has
   no passing verifier yet.

2. **Assert on real state, not status.** Check the actual output value / resulting state, not
   just exit code 0 or an HTTP 200. (See `learnings/seed.md`.)

3. **Present evidence, not claims.** Report the exact command run and its output. "Tests pass"
   is an assertion; the pasted passing output is evidence.

4. **For behavior-level features**, also show the end-to-end check from the spec's
   Verification section (a sample input → expected output, a screenshot/recording for UI).

## Gotchas

| Gotcha | Why it bites | Do instead |
|--------|--------------|------------|
| Trusting exit 0 / HTTP 200 | Commands and endpoints lie | Assert on output/DB state |
| Agent grading its own work in the same context | Self-preferential bias | Use a fresh context — the `code-reviewer` agent |
| "All tests pass" with no output shown | Unverifiable assertion | Paste the command + result |

## Escalating the gate (when this matters more)

- In-prompt: "run the tests and iterate until they pass" (default).
- Stop hook: block finishing until `check.sh` is green (add once a real suite exists; mind the
  8-consecutive-block override).
- Independent judge: the `code-reviewer` subagent in fresh context (see `.claude/agents/`).
