---
name: learn-from-zero
description: Onboard the user on a topic they have zero prior context on — build the mental model from scratch using progressive disclosure and analogies from their existing knowledge. Use when the user says "teach me X from scratch", "I have zero knowledge of Y", "onboard me on Z", "explain X like I'm new", or admits they "don't understand any of this". Saves to Obsidian on request.
---

# learn-from-zero

Teach a topic from the ground up. The user has near-zero prior context. The
output is a layered explanation: foundations first, then context, then how it
connects to what they already know. Output stays in chat first; saving to
Obsidian is opt-in at the end via `_shared/save-to-vault.md`.

## Inputs

Accept the topic as the skill argument (`/learn-from-zero <topic>`). If no
argument is given, ask:

> "Which topic do you want me to teach from scratch? One short phrase."

## Process

1. **Anchor the user's existing knowledge.**
   Read user memory for `user_role` and prior `project_*` entries. If unknown,
   ask once:

   > "Quick context — what's your background? (e.g. frontend engineer, data
   > scientist, student). I'll use that for analogies."

   Use the answer (or memory) to pick analogies throughout. Frontend → Redux
   store, selectors, component lifecycle. Backend → service boundaries,
   transactions, queues. Etc.

2. **Plan the layers before writing.**
   Internally list the minimum chain of concepts needed to understand the
   target topic. Order them so each layer only uses primitives from
   previous layers. Five layers max; if you need more, the topic is too
   broad — ask the user to narrow it.

3. **Render the explanation.** Structure:

   ```
   # <Topic> for <Audience>

   ## TL;DR
   2–3 sentences. The thing they should walk away knowing.

   ## Layer 1 — <foundational concept>
   Define. Give a concrete example. Tie to known analogy.

   ## Layer 2 — ...
   Build on Layer 1.

   ... (up to 5)

   ## How this connects to your work
   Repo files, existing tools, prior sessions. This is where the abstract
   becomes useful.

   ## What to learn next
   2–4 bullets.
   ```

4. **Use concrete examples, not abstract definitions.**
   Every new concept gets a worked example with real numbers / real
   identifiers. Tables and code blocks beat paragraphs.

5. **Offer a follow-up case.** After the explanation, offer:

   > "Want to lock this in with an interactive case study? Run `/learn-by-case
   > <same-topic>`."

6. **Offer save.** Then ask:

   > "Save this explanation to Obsidian?"

   If yes, follow `_shared/save-to-vault.md`. Filename pattern:
   `NN - <Topic>.md`. Topic folder = the topic name in Title Case.

## Pacing

- One layer at a time is fine. If the topic is large, ask between layers:
  > "Make sense so far? Continue to <next-layer>?"
- Do not dump all five layers in one message unless the user asks for the
  full thing up front.

## What this skill is NOT for

- Summarizing an existing doc → use `learn-from-doc`.
- Quizzing the user → use `learn-by-case`.
- Debugging or implementation help → use the relevant engineering skill.

If the user is actually asking one of those, name the right skill and stop.
