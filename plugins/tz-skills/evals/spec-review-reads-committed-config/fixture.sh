#!/usr/bin/env bash
# The delivery config is committed in docs/agents/, and a stale copy is left at the .claude/ fallback:
# the committed file must win. No design-map config. Local-markdown tracker; no shell, so the diff is exported.
set -euo pipefail

mkdir -p src snapshots/recorded docs/agents .claude .scratch/greeting/issues .review

cat > docs/agents/delivery.md <<'EOF'
## Delivery

- **Typecheck:** `bun run typecheck`, run from the repo root.
- **Tests:** `bun test`.

## Review exclusions

Consumed by `/spec-review`.

- Generated, never reviewed: `snapshots/recorded/**`
- Implied by convention, reviewed but not a stray by default: `**/*.test.ts`

A test that asserts a behaviour no ticket row asks for is a stray, whatever its path.
EOF

cat > .claude/delivery.md <<'EOF'
## Delivery

- **Typecheck:** `bun run typecheck`, run from the repo root.

## Review exclusions

Consumed by `/spec-review`.

- Generated, never reviewed: `**/*.lock`
- Implied by convention, reviewed but not a stray by default: `**/*.test.ts`
EOF

cat > docs/agents/issue-tracker.md <<'EOF'
# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`
- Comments append to the bottom of the file under a `## Comments` heading

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.
EOF

cat > docs/agents/domain.md <<'EOF'
# Domain Docs

Read `CONTEXT.md` at the repo root and the ADRs in `docs/adr/`. If either is missing, proceed silently.
EOF

cat > CLAUDE.md <<'EOF'
# greeter

## Agent skills

### Issue tracker

Issues live as markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: root `CONTEXT.md` plus `docs/adr/`. See `docs/agents/domain.md`.
EOF

cat > .scratch/greeting/issues/01-greet-by-name.md <<'EOF'
# Greet a user by name

Status: ready-for-agent

## What to build

Add `greet(name)` to `src/greet.ts`. It returns `Hello, <name>!`.

## Acceptance criteria

- [ ] `greet("Ada")` returns `Hello, Ada!`
EOF

cat > src/greet.ts <<'EOF'
export function greet(name: string): string {
  return `Hello, ${name}!`;
}
EOF

cat > snapshots/recorded/api.json <<'EOF'
{
  "recordedAt": "2026-09-27T10:00:00Z",
  "region": "ap-southeast-1",
  "users": [{ "id": 1, "name": "Ada" }]
}
EOF

cat > .review/branch.diff <<'EOF'
diff --git a/snapshots/recorded/api.json b/snapshots/recorded/api.json
index 3b18e51..9f2c4d7 100644
--- a/snapshots/recorded/api.json
+++ b/snapshots/recorded/api.json
@@ -1,4 +1,5 @@
 {
-  "recordedAt": "2026-09-20T10:00:00Z",
+  "recordedAt": "2026-09-27T10:00:00Z",
+  "region": "ap-southeast-1",
   "users": [{ "id": 1, "name": "Ada" }]
 }
diff --git a/src/greet.ts b/src/greet.ts
new file mode 100644
index 0000000..5c1a2b3
--- /dev/null
+++ b/src/greet.ts
@@ -0,0 +1,3 @@
+export function greet(name: string): string {
+  return `Hello, ${name}!`;
+}
EOF

cat > .review/commits.txt <<'EOF'
a1b2c3d feat: greet a user by name (01-greet-by-name)
e4f5a6b chore: re-record API snapshots
EOF
