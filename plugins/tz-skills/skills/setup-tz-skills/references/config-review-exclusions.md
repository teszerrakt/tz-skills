# Template: the `## Review exclusions` section

Read by `spec-review`. It is a section of the delivery file — `docs/agents/delivery.md`, or the `.claude/delivery.md` fallback — because `ship` runs `spec-review` as one of its phases, and one file then holds what both read.

An older install appended this section to `.claude/fe-design-map.md`. When it exists there and the delivery file has none, offer to move it.

## Detect

Ask for nothing that the repo states. Run these first:

```bash
git ls-files | grep -iE '\.gen\.|generated|package-lock|yarn\.lock|pnpm-lock|__generated__|\.pb\.go$'
git ls-files | grep -iE 'i18n/locales|__snapshots__|\.stories\.'
```

The first command finds the generated files. The second finds the files a convention makes mandatory.

## The two lists are not the same

**Generated** files leave the review entirely. A tool wrote them, so no class applies.

**Implied by convention** files stay in the review and start as `IMPLIED`. They can still become a stray. A test that asserts a behaviour no ticket row asks for is the easiest place to hide unasked work, so the class is a default, not an exemption.

Ask the user to confirm each list before writing. A glob in the wrong list makes a whole directory invisible to the review.

---

```markdown
## Review exclusions

Consumed by `/spec-review`.

- Generated, never reviewed: {{globs}}
- Implied by convention, reviewed but not a stray by default: {{globs}}

A test that asserts a behaviour no ticket row asks for is a stray, whatever its path.
```
