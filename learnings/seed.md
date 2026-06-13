# Seed learnings (workflow-level)

## Trust DB/output state, not status codes
- **Date:** 2026-06-13
- **Symptom:** an agent "verifies" by an HTTP 200 or "no error thrown" and declares success
  while the actual result is wrong.
- **Cause:** endpoints and commands can lie — a 200 with a silently-dropped write, a CLI that
  exits 0 having printed garbage.
- **Rule:** assert on the *resulting state / actual output value*, never just the response
  code or exit status. Verification must check what the user would check.
