---
name: learn-from-doc
description: Digest an external document (URL, Coda/Notion link, local file path) into a concise summary tailored for a junior reader. Use when the user says "digest this doc", "summarize this URL", "give me the gist of this", "what is this document saying", or pastes a link and asks for a TL;DR. Saves to Obsidian on request.
---

# learn-from-doc

Produce a concise, learner-tailored digest of a specific document the user
points at. Output stays in the chat first; saving to Obsidian is opt-in at the
end via the shared `_shared/save-to-vault.md` procedure.

## Inputs

Accept the doc source as the skill argument when invoked
(`/learn-from-doc <url-or-path>`). If no argument is given, ask:

> "Which doc should I digest? Paste a URL or local file path."

Supported sources:

- HTTPS URLs (use `WebFetch`)
- Coda links → use the Coda MCP tools (`url_convert` + `page_read`)
- Notion links → use the Notion MCP tools if available, else `WebFetch`
- Local file paths → use `Read`

## Process

1. **Fetch.** Pull the doc using the appropriate tool. If the content is
   long, do not pre-summarize internally — read it in full so the digest
   reflects the actual structure.

2. **Detect the audience.** Check user memory for a `user_role` entry. If the
   user is described as "frontend engineer" or similar, lean on frontend
   analogies (Redux store, selectors, atomic transactions) in the digest.
   If unknown, ask once at the start.

3. **Draft the digest.** Structure:

   ```
   # <Doc Title>

   > Source: <url-or-path>

   ## TL;DR
   2–4 bullets. The single most important point first.

   ## What is the problem this addresses
   1–2 short paragraphs. Why does this doc exist.

   ## Core ideas
   Bullets or short subsections. Use concrete examples, code blocks where
   the original uses code blocks.

   ## Rules / contracts / non-negotiables
   If the doc states hard rules (like the subledger doc's 5 rules), enumerate.

   ## What this means for me (the reader)
   Connect to the user's known context — files in the current repo, prior
   sessions, frontend analogies. This section is the highest-leverage one.

   ## Open questions / what to learn next
   Bullets. Items the doc gestures at but does not resolve.
   ```

4. **Render the digest in chat.** Use clean markdown. Do not include the
   "what to learn next" as a question to the user — it is content of the
   digest itself.

5. **Offer save.** After the digest is shown, ask:

   > "Save this digest to Obsidian?"

   If yes, follow `_shared/save-to-vault.md`. Filename pattern:
   `NN - Doc - <slug>.md` where `<slug>` is kebab-case of the doc title.

## Length discipline

- TL;DR ≤ 4 bullets.
- "Core ideas" ≤ 6 subsections.
- Total digest: aim for ~1/4 of the source length; never longer than the
  source.

## What this skill is NOT for

- Long-form teaching of a topic from scratch → use `learn-from-zero`.
- Interactive Q&A on a scenario → use `learn-by-case`.
- Code review of a PR or commit → use the project's review skill instead.

If the user's request matches one of those, suggest the right skill and stop.
