---
name: verify-backend
description: "Live-verify a backend change end-to-end against a running app — drive the real endpoints in a client-like flow and assert on responses and persisted state. Use after implementing server/API work, when asked to e2e-test an endpoint or flow, or when /ship's backend track needs its live proof."
---

# Verify backend end-to-end

Confirm a backend change works against a running app, not just in unit tests: drive the real endpoints the way a client would and assert on both responses and persisted state.

## Project config

Read `.claude/live-verification.md` in the repo root. It holds the project specifics this skill can't know: how to launch the app, how to mint client auth/credentials, how to call endpoints (URL prefixes, envelope, private-endpoint quirks), how to inspect the DB read-only, and the domain invariants and cleanup constraints to respect. If it's missing, discover what you can from CLAUDE.md and project docs, ask the user for the rest, then OFFER to write the config file so the next run skips this.

## Setup

- **A brief that names a base URL** — a preview, or a server another step started — is the target. Use it, and start nothing.
- Otherwise launch the app locally (a project skill that knows how, else `/run`), with whatever auth / credentials a real client needs.

## Exercise the flow

1. Hit the real endpoints in the order a client would — e.g. create → read back → mutate → verify — not one endpoint in isolation.
2. Assert on the actual effects: response status / shape and the resulting persisted state (query the DB read-only to confirm, where the target's DB is reachable; otherwise read it back through the API).
3. Check auth / tenancy scoping and any domain invariants relevant to the change (money precision, balance rules, immutability, etc.).
4. Cover failure paths: bad input, unauthorized, not-found.

Keep a **wire log**: one line per call — method, path, status, and the fields you asserted on. A claim you report needs its line in the log. Write tokens as `<redacted>`.

## Clean up & report

- Remove test data only where the config allows it. Financial data is never deleted — reverse it or leave it, and name the ids.
- Fix failures in the code and re-run until green.
- Report pass/fail per step, the flow you ran, what you asserted, the wire log's path, the ids you created, and any files you changed.
