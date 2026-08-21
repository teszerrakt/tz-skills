# Template: `.claude/stakeholders.md`

Read by `ask-stakeholders`. Nothing here is detectable. Ask, or seed it from Slack.

## Seeding from Slack

Offer this once. Given a channel the user names, list its members and propose one block per
member with `Role`, `Answers`, `Does not answer`, and `Register` **left blank**. A guessed
register produces a badly-pitched question. Write no real name until the user confirms it.

## Ask for

1. The channel per topic, and the default channel. A channel id, not a name — the name can change.
2. One block per person the user actually asks. Two or three is a working file; a full team roster
   is sediment.
3. The register per person. This is the load-bearing field, and it is the one the user must say
   out loud. Prompt for it as: *what does this person answer, and in whose vocabulary?*

Keep the worked example in the written file until real blocks replace it. It carries the register
distinction, which one-line field labels do not.

---

```markdown
# Stakeholders ({{REPO}})

Consumed by `/ask-stakeholders`. Per-developer config, not tracked.

Questions go to a **public channel thread**, never a DM. One parent post carries the situation;
one threaded reply carries each bare question.

## Channels

| Topic | Channel | Notes |
|-------|---------|-------|
| {{topic}} | `{{channel id}}` | {{what runs here}} |
| Default | `{{channel id}}` | Used when a question has no named owner |

## People

One block per person.

**{{Name}}**
- Handle: `@{{slack-handle}}`
- Channel: `{{channel id, when it differs from the default}}`
- Role: {{design | backend | product | QA}}
- Answers: {{the kinds of question this person can settle}}
- Does not answer: {{what to route elsewhere instead}}
- Register: {{how technical the question may be}}

## Worked example

Delete this block once the real people are filled in. It shows the shape and the register
difference, nothing more.

**A designer (example)**
- Role: design
- Answers: intended interaction, empty and error states, copy, which affordance a state shows
- Does not answer: endpoint contracts, field nullability, persistence semantics
- Register: plain product language. Name the screen and the field label, never the column or
  the endpoint.

**A backend engineer (example)**
- Role: backend
- Answers: endpoint contracts, field nullability, which value is stored, validation rules
- Does not answer: visual states, copy
- Register: technical. Name the endpoint, the field, and the spec anchor.

## Register, in practice

The same open question, written for each:

> @designer On an order line, can someone type a description and a price with no product selected?

> @backend On an order line, is `product_id` nullable when a unit price is supplied? Spec 4.2.

One fact, two registers. The parent post uses the plainest wording both read, because the
situation is a single fact and two descriptions of one fact drift apart.
```
