---
name: ask-stakeholders
description: Ask a batch of open questions to named stakeholders in a public Slack thread, tailored per persona and capped for brevity. Use when a spec, design doc, or decision has questions only a colleague can answer, or when the user wants to ask design or backend something, or to DM one person in the register the user already uses with them.
---

# Ask Stakeholders

Turn a set of open questions into one public Slack thread that a colleague can answer in a reaction or a sentence.

The shape is fixed: **one parent post carries the situation, one threaded reply carries each bare question.** The channel sees one post. Each reply has its own permalink, so each question stays individually trackable.

## Personas

Read `.claude/stakeholders.md` in the repo root. Per person: name, Slack handle, the public channel to use, role, what they can answer, what they cannot, and the register their questions are written in. A question with no named owner goes to the topic's default channel.

If the file does not exist, ask who owns each question and offer to write the file back.

**A public channel thread is the default**, because that is where the answer stays findable. Do not
choose a DM on your own. When the user explicitly asks for one, follow **DM mode** below, and say in
one line that a thread keeps the answer findable so the trade-off is on the record. Then send the DM:
it is their call and their relationship.

## Situation, not justification

The parent carries the situation once. Every question inherits it, so the questions stay bare.

| Belongs in the parent | Never |
|---|---|
| Which screen or flow this is | "Why now" |
| What the design or spec does now | "Why this is the common case, not the edge" |
| What cannot happen as a result | Prior decisions recounted to the people who made them |
| The doc and Figma links | Citations that pre-litigate a disagreement nobody voiced |
| | Speculative knock-ons |
| | Effort estimates. MD figures are internal planning, not the reader's input: say what is blocked, never what it costs |

Both columns are context. Only the left one helps the reader answer. Strip the right column and a 547-word message becomes 50 words; strip the left one too and the questions arrive with nothing to hold on to.

## Caps

- **Parent: 60 words**, including its example.
- **Each question: 40 words**, including its example.
- One question per threaded reply.
- No headings. Bullets only for three or more genuinely parallel items, one line each.
- The first sentence is the question. No preamble, no closing summary.
- One link per message, unless each link is the evidence needed to answer.

Embed the link when the question turns on a PRD line or a specific piece of code. A question about a contract carries the RFC anchor; a question about behavior carries the Figma frame.

## Examples

An example is situation made concrete. It follows what it grounds, and it always comes **after** the question.

| The example grounds | It goes | Budget |
|---|---|---|
| the whole thread | the parent, as a trailing clause | one, 15 words |
| one question | that question's reply, after the question | one, 20 words |
| nothing in particular | nowhere — cut it | — |

An example is a concrete instance, never an argument. Good: `e.g. a vendor's "shipping fee" line`. Not an example: `if we don't allow this, users will be blocked` — that is speculation.

## Open by default

Write the open question. Add a trailing default clause only when there is a strong recommendation to state:

> When the picker's product price and the invoice's price differ, which one is stored on the line? Assuming the invoice price unless you say otherwise.

That clause converts a written reply into a 👍, and it gives silence a defined meaning. It costs the reader a decision they did not ask for, so it earns its place only on a question where the recommendation is genuinely strong.

## DM mode

Only when the user explicitly asks to DM someone. One person, one message.

**Read their DM history first.** `slack_read_channel` with the person's `user_id` as `channel_id`,
~60 messages. You are learning four things: the language, what the user calls them, what they call
themselves, and the message length. Never guess a register you have not read.

**Record what you learn** in `.claude/stakeholders.md` under that person, so the next DM does not
re-derive it. A register learned and not written down is a register learned twice.

**The shape changes.** A DM is a conversation, not a channel post, so the parent-plus-threaded-reply
split does not apply and neither do its word caps. Send one message. Everything else holds: the
situation once, bare questions, no justification, an example only where it grounds something, and
one question per topic so each stays answerable on its own.

**What survives from thread mode**
- Bare questions. Ask only what that person can actually answer, per their persona.
- A trailing default clause where the recommendation is genuinely strong.
- No headings, no closing summary, no estimates.

**What changes**
- No `<@U...>` mention: it is a DM, they are the only reader.
- Address them the way the user does, and refer to the user the way the user does.
- Match the user's own language, not the skill's. If their DMs are not in English, the DM is not in
  English either.
- Keep technical vocabulary in the original language of the codebase, **nouns and verbs both**. A
  mixed-language register borrows technical terms wholesale rather than translating them; translating
  a technical verb is the tell that a machine wrote it.
- Drop anything the reader cannot act on. If the user is informing rather than asking, one short
  visibility line at the end covers the rest, and no question is manufactured for it.

**Still show the whole message and wait for confirmation before sending.** The register is the part
most likely to be wrong, and only the user can tell you.

## Flow

1. **Group** the questions by owner, using the personas.
2. **Draft** the parent and every threaded reply. Tailor each question to its owner's register. The parent stays in the plainest register both audiences read — the situation is one fact, and two descriptions of one fact drift apart.
3. **Show the user the whole batch** as it will appear, with a word count per message. Nothing is sent before they confirm.
4. **Post** the parent, then each reply against its `thread_ts`. In DM mode, send the single message to the person's `user_id`.
5. **Return the permalinks**, one per question, so the caller can record each one beside its question in the source doc.

More than five questions in one batch means the source is not ready. Say so instead of posting.

## Shape

```
parent   Create Bill — 3 open questions 🧵
         The new design gates a line's description to the product picker and
         makes unit price read-only. So a scanned line for a product we don't
         have yet can't be entered — e.g. a vendor's "shipping fee" line.
         Doc: <link> · Figma: <link>
         cc @designer @backend

  1/     @designer Should a line allow a free-text description plus a typed
         price, with no product selected?

  2/     @backend When the picker's product price and the invoice's price
         differ, which one is stored on the line? e.g. product says 12,000,
         invoice says 12,500.

  3/     @backend Do one-off items need a product row created first, or can
         they post without one?
```
