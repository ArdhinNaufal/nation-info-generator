# learnings/

Gotchas discovered the hard way — the step most people skip, and (per the corpus) why most
developer success plateaus. **Append-only.** One entry per gotcha.

Record a learning when the agent stumbles on something the code doesn't say: an endpoint that
lies with a 200, a field-name alias, a non-obvious ordering requirement, a tool quirk. When a
learning recurs or becomes a hard constraint, promote it: into a skill's Gotchas section, or
into `CRITICAL-RULES.md` with a verifier.

Entry format:

```
## <short title>
- **Date:** YYYY-MM-DD
- **Symptom:** what went wrong / looked fine but wasn't.
- **Cause:** the real reason.
- **Rule:** what to do instead (one line, actionable).
```
