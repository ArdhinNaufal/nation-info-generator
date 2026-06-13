# CRITICAL-RULES.md — constraints, each with a verifier

> Every rule below is intended to be enforced by a build, a test, or an inspection — **not**
> by the model reading and remembering. When a rule's verifier is weak, the rule will drift;
> strengthen the verifier rather than the wording. Keep this list short and bare.

| # | Rule | Verifier (the check that enforces it) |
|---|------|----------------------------------------|
| 1 | No secrets committed to the repo. | `git diff` inspection on commit + (recommended) a secret-scanning pre-commit/CI step. |
| 2 | Every shipped feature has an automated test that proves its acceptance criteria. | `.claude/skills/verify/` test run; CI must be green before merge. |
| 3 | Tests must not call live external services / paid APIs — use fixtures or a test mode. | Test suite runs offline; CI has no production credentials. |
| 4 | A task is "done" only with evidence (command + output, or a passing verifier), never an assertion. | Reviewer/Stop-hook requires attached evidence; see `.claude/skills/verify/`. |

<!--
Add a rule ONLY after a real failure makes you want it, and ONLY with a verifier named in the
right-hand column. A rule with no verifier is a wish, not a rule. Project-specific examples to
add once the spec exists, e.g.:
  - "Nation identifiers are always ISO-3166 alpha-2"  → schema/type check + test.
  - "Output is deterministic for a given input"       → golden-file comparison test.
-->
