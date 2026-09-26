# Live API Capture Playbook

Rules for capturing real request/response samples for the doc's Data Source section.

## Token

- **Read the token source from the project config first.** When it names a command — a make target, a script — run that. It needs nothing from the user.
- Ask the user to paste a fresh token only when the config names no command, or the command fails. Staging JWTs expire, so a stored one is worthless.
- Keep it in a shell env var for the session only: capture or paste it in the same Bash call that uses it. Capture it without printing it — a command that echoes the token to stdout puts it in the transcript.
- NEVER: echo it, log it, write it to any file, put it in the doc, or include it in a code sample. Redact `Authorization` headers everywhere.

## Capture limits and plan (one approval, at chart time)

The capture runs AFK, so its one approval comes before it starts. At chart time the user approves the **capture limits**: the staging entity, the logins by the capabilities they hold, and whether undeletable leftovers are acceptable. See the SKILL's chart step 3.

Before any call, the agent writes the full choreography to `api/capture-plan.md` as one table: order, method + path, login, purpose, body summary. It then runs the plan end to end without asking. The plan may only use the approved entity and logins, and may only mutate data it created itself.

- **Self-cleaning**: mutations operate on data the plan itself creates. Shape: create, read, mutate, delete, in that order, reusing the created ids. Staging ends the run as it started.
- **Identifiable test data**: prefix every created name/code with `ZZ-DOCGEN` so leftovers are findable if a step fails mid-run.
- **Stop on surprise**: an unexpected error aborts the remaining plan. Report state (what was created, what was cleaned) in `api/capture-report.md` and hand back, since no one is there to ask. A behaviour a gap already predicted is not a surprise; it is evidence for that gap.
- **Update the gaps in place**: a capture that confirms, sharpens or disproves a `G-n` replaces that gap's **Now:** line. A new gap follows the harvest's rules: a need Figma draws gets a `G-n` and a needs row, and anything else goes under `## Undrawn`.
- Verify cleanup at the end: re-list, confirm the ZZ-DOCGEN rows are gone, and name every leftover (id, code, state) under a `## Leftovers` heading in `api/capture-report.md`, or write `None` there.

## What to capture per endpoint

- The happy-path request + response.
- Error cases that drive UI copy: duplicate/conflict (inline field errors), blocked-precondition (disabled actions, warning modals), stale-version (refetch + toast). Skip generic 401/500 noise.
- Note which response fields the FE actually consumes; call out traps inline (flags never to send, optimistic-lock fields to echo back).

## Provenance ladder

Every JSONC block opens with a provenance comment. Prefer higher tiers; never present a lower tier as a higher one.

1. `// <METHOD> <path>` + `// Response 200 (live staging, YYYY-MM-DD)` - captured this run
2. `// Postman saved example (collection: <name>)` - from a saved response, not re-verified
3. `// not captured live - derived from <handler/schema path>` - synthesized from code

## JSONC style

- Fence as `jsonc`: the samples carry `//` comments, which plain `json` does not allow. Real ids, real timestamps from the capture.
- Pretty-print every body: 2-space indent, one key per line, every object and array of objects expanded. Only a short array of scalars (`["WHATSAPP"]`) stays on one line. Several error bodies in one block are each expanded, a blank line between them. The provenance comment stays as captured, however long.
- Redact PII (emails, person names) but keep UUIDs and shapes intact.
- Inline `//` comments only for constraints the shape can't show: auto-generated fields, fields never to send, optimistic-lock echoes, gap references (G-n).
- curl convention: `curl -sS -H "Authorization: Bearer $TOKEN" ... | jq .`
