#!/usr/bin/env bash
# Builds a repo whose feat/tra-40 branch adds the Archive button; rows.json and ticket.md stay out of its history.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
cd "${1:-.}"
git init -q -b main
git config user.email eval@example.com
git config user.name eval
mkdir -p src/components
cp "$here/versions/project-header.base.tsx" src/components/project-header.tsx
git add src && git commit -qm "feat: project header"
git checkout -qb feat/tra-40
cp "$here/versions/project-header.head.tsx" src/components/project-header.tsx
git commit -qam "feat(TRA-40): archive button on the project header"
cp "$here/fixture/ticket.md" "$here/fixture/rows.json" .
printf 'ticket.md\nrows.json\n' >> .git/info/exclude
# The run has no shell, so these files stand in for git, as driven mode's subagent brief gives them.
git diff main...feat/tra-40 > diff.patch
git diff -U0 main...feat/tra-40 > diff-u0.patch
git diff --name-only main...feat/tra-40 > names.txt
git log --oneline main..feat/tra-40 > log.txt
printf 'diff.patch\ndiff-u0.patch\nnames.txt\nlog.txt\n' >> .git/info/exclude
