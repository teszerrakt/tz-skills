---
name: standup
description: Draft my daily standup for the Standuply bot — yesterday's work (from my last standup plan + PRs I opened/merged), today's plan (reconciled from leftovers + my input), and blockers, summarized at team altitude with ticket/PR links. Use when I ask for "standup", "daily standup", "what did I do yesterday", "standup summary", or to prep my Standuply answers.
---

# Daily Standup Draft

Drafts my three Standuply answers, gets my approval per question, then hands me paste-ready blocks.

## Config

Read `.claude/standup.md` in the repo root. It holds every value that differs per person and per workplace:

```markdown
- Standup channel: `#<name>` = `<slack channel id>`
- My GitHub login: `<login>`
- My Slack user id: `<slack user id>`
- Ticket system: GitHub issues on `<owner>/<repo>`, or Linear with workspace slug `<slug>` and prefix `<PRE>`
```

If the file is missing, ask me for these values, then offer to write it back so the next run skips the questions. Keep the file untracked — it names a private workspace.

Check which ticket system my recent standup replies and branches actually use, and match it. A Linear workspace URL slug often differs from the GitHub org name; read both from the config rather than inferring one from the other.

## Fixed facts

These do not vary, so they stay here.

- Standuply asks 3 questions, in this order:
  1. `What did you do yesterday?`
  2. `What do you plan on doing today?`
  3. `Okay, any obstacles?`
- Answer style: bullet list, one line per item, English. Tag `(BE)` / `(FE)` / `(BE + FE)` / `(docs)` where it applies. Blockers default to `Nope` (capital N) when there are none.
- **Submission constraint:** the Slack integration CANNOT reach Standuply's DM (bot DM is `channel_not_found`). Do NOT try to auto-send into Standuply. Deliver via approve-then-paste (see step 6).

## Altitude — the most important rule

The audience is my team, not my future self. They do not read the changelog. Write the theme, not the work log.

- **Two to three bullets per answer. Never more than four.** If I did six things, they belong to one or two themes — name the themes.
- **No sub-bullets.** If several tickets serve one goal, write one line for the goal and link the parent/epic ticket, not each child.
- **Name the outcome, not the steps.** Write "another review round, still in review". Do NOT write which contradictions I resolved, which sections I edited, or how many commits it took.
- **Drop the mechanics.** No commit counts, no review-round numbers, no file or function names, no per-section citations.
- **Link only what someone would open** — the PR, or the epic issue. Not every child ticket.

The gathering steps below collect fine-grained detail on purpose; that detail is raw material for reconciliation, NOT the draft. Compress it before writing. When a day genuinely was one thing, one bullet is the correct answer — do not pad it.

## Flow

### 1. Resolve dates
Run `date +%Y-%m-%d` (today) and compute "yesterday" = previous **working** day (Mon → use last Fri). State both dates back to me.

### 2. Gather what I did yesterday
Collect from all three sources, then reconcile:

- **My last standup's plan** — read the standup channel's recent messages; each day's answers live in the thread under a Standuply parent. Open the most recent standup thread and find MY reply.

  Standuply relays every teammate's answers under its own bot identity, so the `From:` field on a reply is NOT the author — do not trust it. Identify my reply by content: it cites tickets and PR numbers that match my branches and my `gh search prs` results. If two replies are genuinely ambiguous, ask me which is mine.

  Extract its `What do you plan on doing today?` bullets — these are my candidate "did yesterday" items.
- **PRs I touched** — run these, across all repos, and KEEP the `url` field for each result:
  - `gh search prs --author=<login> --merged-at=<yesterday> --json title,url,repository,state,number`
  - `gh search prs --author=<login> --created=<yesterday> --json title,url,repository,state,number`
  - `gh search prs --author=<login> --updated=<yesterday>..<today> --json title,url,repository,state,number`

  The flag is `--merged-at=<date>`. `--merged` is a boolean and errors on a date.

  All three can come back empty on a day I only pushed to an existing PR. When they do, fall back to local git — this is the reliable signal:
  - `git log --all --author=<me> --since=<yesterday> --until=<today> --pretty='%h %ad %s' --date=short`
  - `git for-each-ref --sort=-committerdate --format='%(committerdate:short) %(refname:short)' refs/heads refs/remotes | head -20`

  Then check the state of anything I planned but did not obviously finish: `gh pr view <n> --json isDraft,state,reviewDecision` and `gh issue view <n> --json state`. A PR still `isDraft` or at `CHANGES_REQUESTED` is NOT landed.

  Capture title, ticket, repo, PR url, merged/open/draft state.
- **Ask me:** "Anything you did yesterday that's not in your last plan or your PRs?"

**Reconcile:** match planned items against PRs. Planned + has a merged/open PR → shipped (cite ticket + PR url). Planned + no PR → likely carried over (hold for step 3, don't claim as done). Flag any PR with no matching planned item as a real "also did" line.

### 3. Gather today's plan
- **Suggest first:** list the carry-forward items (planned yesterday, no PR / not done) as today candidates, plus anything I flagged as blocked-but-now-unblocked.
- **Ask me:** "What are you planning today? (I've pre-filled the leftovers above — add / remove / confirm.)"

### 4. Blockers
Ask: "Any blockers?" Default to `Nope` (capital N). Note dependencies surfaced in step 2/3 (e.g. FE work blocked on a BE ticket) as blocker candidates.

### 5. Draft
Produce the three answers in Standuply format (see EXAMPLE below). **Apply the Altitude rules above before writing** — compress the gathered detail into themes, then write.

Links: use the ticket system named in the config, plus the PR `url` from `gh search prs`. Link the PR and the epic only — not every child ticket.

Before presenting, re-read the draft and cut: any bullet past the fourth, every sub-bullet, every count, every section reference. If two bullets name the same goal, merge them.

### 6. Approve, then deliver as a self-DM thread
Present the draft for my approval (yesterday → today → blockers); revise until I say go.

**Default delivery — post to my self-DM as a titled thread** (so links render formatted and I can copy each answer straight into Standuply):
1. `slack_send_message` to `channel_id` = my Slack user id from the config (my self-DM) with parent text `**Daily Standup - Draft - <today YYYY-MM-DD>**` + a one-line note ("each question = a label reply followed by a content-only reply; copy just the content"). Capture the returned `message_ts` and `channel_id` (DM resolves to a `D…` channel).
2. Send **two threaded replies per question** (`thread_ts` = parent ts, `channel_id` = the `D…` id), **one at a time, in order**, so the labels and content stay interleaved:
   - a **label reply** — `**① What did you do yesterday?** _(content below ↓)_`
   - a **content-only reply** — just the bullets, no header, so I can copy it clean into Standuply.
   Repeat for ② today and ③ obstacles. WHY: keeping the label out of the content reply lets me copy only the answer text.
3. Return the parent + the 3 content-reply links to me.

**Link formatting:** use standard-markdown labeled links — `[#NNN](<issue url>)` and `[#1234](<pr url>)` — `slack_send_message` renders them. Use `**bold**` for each question header. (Bare URLs are only needed when I paste raw text outside Slack; inside the self-DM thread, labeled links carry over when I copy.)

**Notes:**
- There is no message-delete tool — if a stray message gets sent, tell me to delete it manually.
- Standuply's bot DM is NOT reachable, so I still copy each reply into Standuply myself.

## Example — right altitude (labeled markdown links, as sent to the self-DM thread)

```text
**What did you do yesterday?**
• Server-driven table contract (ADR-021 + RFC-012) — another review round, still in review. [#522](https://github.com/example-org/example-repo/pull/522)

**What do you plan on doing today?**
• Land the two open docs PRs: the table contract and the app shell vocabulary. [#522](https://github.com/example-org/example-repo/pull/522) · [#549](https://github.com/example-org/example-repo/pull/549)
• Start the app shell build (FE) — tokens, shell frame + header, sidebar, routes. [#527](https://github.com/example-org/example-repo/issues/527)

**Okay, any obstacles?**
Nope
```

## Counter-example — too detailed, do NOT write this

This is the same day, drafted from the raw gathered detail. It is what the skill produced before the Altitude rules existed.

```text
**What did you do yesterday?**
• #514 (docs) — ninth review round on ADR-021 + RFC-012: resolved eight contradictions, scoped
  the snapshot rule, stated the batch ceiling's reason. [#514] · [#522]

**What do you plan on doing today?**
• #514 (docs) — clear the remaining changes-requested review and land ADR-021 + RFC-012. [#522]
• #532 (docs) — undraft and land the app shell vocabulary in CONTEXT.md. [#549]
• #527 (FE) — start the shell build:
    ◦ #542 — add the missing shell design tokens to the Tailwind config. [#542]
    ◦ #548 — build the shell frame + Global header. [#548]
    ◦ #544 — build the sidebar. [#544]
    ◦ #545 — route table: paths and the real-versus-placeholder split. [#545]
```

What is wrong with it: the round number and the contradiction count are mechanics nobody tracks; the four sub-bullets are one goal split four ways; every child ticket is linked when the epic would do; `CONTEXT.md` is a file path in a status update. The right-altitude version above carries the same information for the reader who actually cares.
