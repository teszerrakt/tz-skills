---
name: learn-by-case
description: Run an interactive case-study quiz on a topic — present scenarios, accept the user's answer, evaluate, and walk through the correct answer with a lesson. Use when the user says "study case on X", "quiz me on X", "interactive learning on Y", "give me a worked example I can practice", or "I need a use case to learn through this". Saves the full round-by-round transcript to Obsidian on request.
---

# learn-by-case

Drive an interactive learning session built around a concrete scenario. The
user attempts each round, the skill evaluates, then explains the correct
answer and the lesson. The full transcript can be saved to Obsidian using the
shared procedure.

## Inputs

Accept the topic (and optional scenario hint) as the skill argument
(`/learn-by-case <topic> [scenario]`). If no argument is given, ask:

> "What topic do you want to drill on? Optionally give me a scenario
> (e.g. 'small trading SMB buying then selling phone cases')."

## Process

1. **Establish the scenario.**
   Pick one concrete, multi-step scenario that exercises the topic end to
   end. Use real numbers, real names, and a domain the user already lives in
   (Indonesian SMB, frontend feature, etc.). Show the scenario setup once:

   ```
   ## Setup
   [the actors, the starting state, any baseline tables / accounts /
   inventory / data]
   ```

2. **Explain the rules of the loop.**
   On the first round, tell the user:

   > Rules:
   > - I ask, you guess, I correct and explain.
   > - Wrong answers are the point. Say "idk" if blank.
   > - "skip" → next round. "stop quiz" → end.
   > - I'll keep the running state visible if you ask.

3. **Run the rounds.**
   For each round:

   1. **Scenario delta** — one event or question (date, amount, what happened).
   2. **Questions** — 2–4 specific asks (e.g. "Journal entry? Bucket changes?
      Status?"). Optionally a bonus harder question.
   3. **Stop and wait** for the user's answer. Do not pre-answer.

4. **Evaluate the user's answer.**
   - If correct → `[!success]` callout, brief confirmation, move on.
   - If partial → mark the right parts ✅, fix the wrong parts.
   - If wrong → never mock; identify exactly what they got right (direction,
     account type, math) and isolate the one concept that broke. State the
     correct answer fully. Add a short Lesson.

5. **Maintain running state.**
   After each round, keep an authoritative state snapshot (account
   balances, status table, subledger rows, etc.) so the user can ask for it.
   Refresh on demand or at the start of any new round if state changed
   meaningfully.

6. **Handle interrupts.**
   - "wait, what is X?" → drop into a brief sidebar explaining X, then
     resume the same round. These sidebars are first-class lessons —
     remember them for the save.
   - "I don't know how to do this" → walk through it together as a guided
     exercise instead of declaring wrong.
   - "stop" → wrap up, offer save.

7. **End the session.**
   When the user says "stop quiz" or the scenario reaches a natural end,
   summarize:

   - What concepts landed.
   - What's still soft / revisit.

   Then offer:

   > "Save this case study to Obsidian?"

   If yes, follow `_shared/save-to-vault.md`. Filename pattern:
   `NN - Case - <slug>.md`.

## Save formatting (specific to learn-by-case)

When writing the Obsidian file, structure each round using **Obsidian
callouts** (renders as colored boxes):

```markdown
## Round N — <one-line title>

> [!question] Scenario
> ...
>
> Questions:
> - ...

> [!fail] My Answer            (or `[!success]` if correct)
> verbatim or near-verbatim of what the user said

> [!success] Correct Answer
> ...

> [!note] Lesson
> 2–4 bullets. What broke, why, the rule of thumb.

> [!info] Side Question — "<the side question>"  (only if there was one)
> Brief recap of the detour.
```

Always include a final `## Session Outcome` section listing concepts that
landed vs. concepts still soft (revisit list).

## What this skill is NOT for

- Initial onboarding when the user has zero context → use `learn-from-zero`
  first, then come here.
- Digesting a doc → use `learn-from-doc`.
- Real work the user wants to ship → not a learning task; use the relevant
  engineering skill.

If the user has zero context on the topic, suggest running `learn-from-zero
<topic>` first.
