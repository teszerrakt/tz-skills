#!/usr/bin/env bash
# A small TypeScript repo where Matt Pocock's setup has run: his three files sit in docs/agents/.
set -euo pipefail

mkdir -p src docs/agents

cat > package.json <<'EOF'
{
  "name": "greeter",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "bun test"
  }
}
EOF

cat > src/index.ts <<'EOF'
export function greet(name: string): string {
  return `Hello, ${name}!`;
}
EOF

cat > src/index.test.ts <<'EOF'
import { expect, test } from "bun:test";
import { greet } from "./index";

test("greets by name", () => {
  expect(greet("Ada")).toBe("Hello, Ada!");
});
EOF

cat > README.md <<'EOF'
# greeter

Greets people. Issues live in GitHub Issues on example/greeter.
EOF

cat > CLAUDE.md <<'EOF'
# greeter

Run `bun run typecheck` and `bun test` before a PR.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on example/greeter, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default roles, each label string equal to its name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` plus `docs/adr/`. See `docs/agents/domain.md`.
EOF

cat > docs/agents/issue-tracker.md <<'EOF'
# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.
EOF

cat > docs/agents/triage-labels.md <<'EOF'
# Triage Labels

| Label in mattpocock/skills | Label in our tracker |
| -------------------------- | -------------------- |
| `needs-triage`             | `needs-triage`       |
| `needs-info`               | `needs-info`         |
| `ready-for-agent`          | `ready-for-agent`    |
| `ready-for-human`          | `ready-for-human`    |
| `wontfix`                  | `wontfix`            |
EOF

cat > docs/agents/domain.md <<'EOF'
# Domain Docs

Read `CONTEXT.md` at the repo root and the ADRs in `docs/adr/`. If either is missing, proceed silently.
EOF
