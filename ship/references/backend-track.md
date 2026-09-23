# The backend track

Reference for `/ship` when a ticket's plan touches a backend path. Read before
step 4. Every other phase runs as `SKILL.md` writes it.

## Keys

`## Delivery` marks this track's keys `(BE)`:

| Key | Holds |
|---|---|
| Typecheck (BE) | the compile check, and the directory it runs from |
| Lint (BE) | the linter, limited to code new since the base branch |
| Tests (BE) | the rule for where a test sits, and the command scoped to a package |
| Live verification (BE) | the skill that drives real endpoints and asserts persisted state |
| Live target (BE) | `preview` or `local`, and that mode's values |
| Migrations (BE) | each migration directory, and how a file is numbered |

A key with no value makes its phase report `SKIPPED`, as on the frontend track.

## Step 4 — tests, typecheck, lint

Follow the `Tests (BE)` rule for where a test sits. Run tests for the packages
the diff touches; CI runs the whole suite. When the brief names a lock for the
test command, take it around every run: parallel runs of one app can share a
test database, and one run's reset drops the other's connections.

Lint only what is new since the base branch. The repo's older findings are not
this ticket's, and a fix to them is a stray to `/spec-review`.

## Migrations

A migration number is a plain sequence per service. Two branches that each take
the next free number collide: the host refuses a set with a duplicate, so the
second merge breaks every build. On a preview it is quieter — its database is a
copy of one already at that version, so the branch's own migration is **skipped
without an error**.

Before every push, for each migration file the diff adds:

1. Fetch the base branch.
2. Confirm the number is free there and in every open PR's files
   (`gh pr list --state open --json number,files`).
3. Taken: rename to the next number free in both, and amend.

A number assigned in the brief was reserved by `/ship-epic` against its sibling
sessions. Use it as given, and still run the check.

## Step 5 — live verification

Runs when the diff changes an endpoint: its path, its request or response, its
permission, or what it persists. A change with no endpoint effect reports
`SKIPPED` — its tests carry it.

Invoke the `Live verification (BE)` skill, forked. The brief carries the ticket
id, the diff range, the live target's base URL, and one question: does each
changed endpoint do what the criteria say, scoped to its tenant, on its failure
paths too? The skill fixes what fails, so each fix is a commit, and on a preview
a push and another wait.

## Live target

**`preview`.** The host builds one backend per PR from the step-4b push.

1. Wait for the deploy check the key names on the head SHA
   (`gh api repos/{owner}/{repo}/commits/<sha>/check-runs`) to read `success`.
2. Probe the key's URL. An app that is not up answers with the host's own
   not-found page; an app that is up answers an unknown path with its own JSON
   404.

Ten minutes without both is abort 8. The preview's database is a copy of the
seed environment taken when the preview was created. A flow that needs data
creates it through the API rather than trusting the copy to hold it.

**`local`.** The key names the start command, the seed command, and the port.

1. Start the backend in an infra namespace of its own — `ship-<ticket>` — on the
   brief's port, or the key's default.
2. Seed the login user into that namespace.
3. Stop the server when the step ends, and delete the namespace when the run
   ends.

A shared namespace is shared data: two branches with different migrations break
each other's schema.

**No fallback between modes.** A preview that never comes up is abort 8, not a
reason to start a local server. The two modes prove different things, and a
body cannot say which one ran if either might have.

## Step 10b — the proof

Re-run step 5's flow once against the final head, editing nothing, and keep its
wire log: steps 7 and 8 may have changed the code step 5 proved. It runs under
the same condition as step 5.

The wire log goes to the verification bundle. The body carries one row per
claim, each backed by a line in the log:

```markdown
## Live verification

| Call | Status | Checked |
|---|---|---|
| POST /v1/app/gl/bills | 201 | row status = draft, scoped to the caller's entity |
| POST /v1/app/gl/bills (other entity's token) | 404 | no row leaked |
```

**Name what the run created outside the target.** A preview's rows die with it
and a local namespace's with the run, but an identity-provider user or a stored
file outlives both. List the ids, and what was not done to them.
