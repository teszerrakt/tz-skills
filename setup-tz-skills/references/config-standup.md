# Template: `.claude/standup.md`

Read by `standup`. Four values and one rule.

## Ask for

1. The standup channel id.
2. The user's own Slack user id. `standup` posts the draft to that self-DM.
3. The user's GitHub login. `standup` reads their merged PRs with it.
4. Which ticket system the standup links.

## Detect

Run `git remote -v` for the repo owner and name. Then check the user's recent branch names and
commit messages for a ticket tag: a bare `#NNN` points at GitHub issues, a `PREFIX-###` points at
an external tracker.

**Ask for the tracker's URL slug rather than deriving it from the remote.** A tracker workspace
slug and a GitHub org name are two names for one company and they differ often. A wrong slug
produces a dead link in every standup.

---

```markdown
# standup config ({{REPO}})

Consumed by the `/standup` skill. Per-developer config, not tracked.

- Standup channel: `{{#name}}` = `{{channel id}}`
- My GitHub login: `{{login}}`
- My Slack user id: `{{user id}}` (self-DM target for the draft thread)

## Ticket system

Check which one my recent standup replies and branches use, and match it.

- **GitHub issues** — tag `#NNN`, link `https://github.com/{{owner}}/{{repo}}/issues/NNN`.
- **{{Tracker}}** — tag `{{PREFIX}}-###`, link `{{ticket url base}}/{{PREFIX}}-###`. The URL slug is
  `{{slug}}`, **not** `{{owner}}`: the GitHub repo owner is `{{owner}}/{{repo}}` but the tracker URLs
  use `{{slug}}`.
```
