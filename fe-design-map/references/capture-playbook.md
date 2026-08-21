# Live API Capture Playbook

Rules for capturing real request/response samples for the doc's Data Source section.

## Token

- Always ask the user to paste a fresh access token (staging JWTs expire; there is no automated source).
- Keep it in a shell env var for the session only: `read`-style paste or export in the same Bash call that uses it.
- NEVER: echo it, log it, write it to any file, put it in the doc, or include it in a code sample. Redact `Authorization` headers everywhere.

## Capture plan (one approval)

Before any call, draft the full choreography and present it as one table: order, method + path, purpose, body summary. Get a single approval, then run it end to end.

- **Self-cleaning**: mutations operate on data the plan itself creates. Shape: create, read, mutate, delete, in that order, reusing the created ids. Staging ends the run as it started.
- **Identifiable test data**: prefix every created name/code with `ZZ-DOCGEN` so leftovers are findable if a step fails mid-run.
- **Stop on surprise**: an unexpected error aborts the remaining plan; report state (what was created, what was cleaned) and ask before continuing.
- Verify cleanup at the end (re-list, confirm the ZZ-DOCGEN rows are gone).

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

- Fence as `jsonc`. Real ids, real timestamps from the capture.
- Redact PII (emails, person names) but keep UUIDs and shapes intact.
- Inline `//` comments only for constraints the shape can't show: auto-generated fields, fields never to send, optimistic-lock echoes, gap references (G-n).
- curl convention: `curl -sS -H "Authorization: Bearer $TOKEN" ... | jq .`
