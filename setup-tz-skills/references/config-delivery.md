# Template: the `## Delivery` section

Read by `ship`. It appends to `.claude/fe-design-map.md` rather than to a file of its own, because the facts it sits beside — the tracker, the ADR and RFC paths, the shared UI package under `## Sources` — are the same facts a driven run needs.

## Detect

Ask for nothing the repo states.

```bash
git ls-files | grep -iE 'check-prose|prose|pr-lint'
git ls-files | grep -iE 'tailwind.*\.css$|tokens?\.css$|theme\.css$'
ls .claude/skills/
```

The first finds the PR prose gate. The second finds the token file a colour assertion resolves against. The third finds the repo-scoped skills the phases delegate to — a screenshot skill and a test-policy skill are the two that matter.

For the typecheck command, read the monorepo task runner's config and then the app's own `package.json`. **An app that declares no `typecheck` script usually typechecks through `build`** — a `tsc -b && <bundler> build` is the same compile, and naming the absent task instead produces a phase that silently passes.

## Name skills, not commands

Every key whose phase carries judgment names a **skill**. A command in that slot forces `ship` to learn which states earn a screenshot and which seam a test belongs to — knowledge that already lives in the repo's own skills, and the reason the driver stays portable.

A key with no value at all is correct when the repo has no such phase. `ship` reports that phase `SKIPPED` rather than inventing one.

## Environment traps earn their place by having cost time

This subsection is the one place a machine-specific gotcha belongs: the driver ships from tz-skills and carries none. Write only traps someone has actually hit — a browser automation that fails on this OS, a CLI that aborts silently, a route that redirects for the wrong role. A speculative trap costs every delegate's attention for a failure that never happens.

**Never write a credential here.** Name the gitignored file that holds it.

---

```markdown
## Delivery

Consumed by `/ship`. Each key names the project's half of one phase; a phase
whose key is absent reports `SKIPPED`.

- **Worktree root:** {{path}}. Phase 0 copies every file `.claude/.gitignore`
  lists that exists in the main checkout, then installs dependencies.
- **Typecheck:** {{command}}, run from {{dir}}.
- **Tests:** {{skill}}. It owns which seam a test belongs to and what it may
  assert; take its judgment over the driver's.
- **Screenshots:** {{skill}}.
- **Design assertion:** {{skill and mode}}.
- **Live verification:** {{skill and mode}}. Runs only when a ticket's
  acceptance turns on what the server sends; every other ticket reports
  `SKIPPED`.
- **Verification bundle:** {{branch pattern}}, {{directory}}. A recording's
  video, wire log and decisive frame are committed there, never to the PR
  branch.
- **Token file:** {{path}}. A browser reports colour as `oklch(…)`, so assert
  token identity against this file rather than the hex a design names.
- **PR prose gate:** {{command}}.
- **PR body sections:** {{headings, in order}} — at most {{n}} sections,
  at most {{n}} table, {{other caps}}.
- **PR body write path:** {{command}}, then read the body back and confirm it
  changed.

### Environment traps

Tell each delegate the ones its phase can hit.

- {{trap}}
```
