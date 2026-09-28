#!/usr/bin/env bash
# A small TypeScript repo where Matt Pocock's setup has never run: no docs/agents/.
set -euo pipefail

mkdir -p src

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

cat > README.md <<'EOF'
# greeter

Greets people. Issues live in GitHub Issues on example/greeter.
EOF

cat > CLAUDE.md <<'EOF'
# greeter

Run `bun run typecheck` and `bun test` before a PR.
EOF
