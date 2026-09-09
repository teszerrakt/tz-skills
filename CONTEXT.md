# tz-skills

Personal Claude Code skills. This file is the glossary: one word per concept, across every skill in the repo. It holds no procedure and no implementation detail.

## Language

### Shared

**Fact base**:
The machine-local directory that holds every fact a skill harvested. Never pushed to a remote.
_Avoid_: cache, scratch dir, workspace

**Gate ledger**:
A file of runnable checks, written before the work starts, that decides whether the work is done. A ticked box with no evidence is unmet.
_Avoid_: checklist, definition of done

**Questions section**:
The one shape a skill uses to ask a human anything: its own section at the top of the reply, under a `❓` heading, holding one block per question. A block is the question in under 15 words, then **one option per bullet** — the choice bolded, then what a person would see, under 15 words each — then a `✨` line recommending one, then a single `Asked because:` line carrying only what the answer turns on. Questions are labelled `Q1`, `Q2`, the labels `/grilling` already uses. At most four. No field names, no file paths, no review vocabulary.

**Not a table.** A terminal renders `<br>` literally, so a table cell cannot hold one option per line, and options crammed onto one line are the failure this shape exists to fix.

Four ways a question goes unread, all measured rather than assumed: written as prose, written as a data structure, placed after the explanation, or padded past a glance. A fifth wastes the reader instead: asking without recommending, which offloads the asker's own judgment. Never write an empty one.
_Avoid_: questions table, open questions section, clarifications, blockers list

**Build ticket**:
A tracker issue that one coding session implements.
_Avoid_: task, story, work item

**Map ticket**:
A child issue of a wayfinder map that resolves one decision or one harvest.
_Avoid_: research ticket, spike

### Delivery

**Phase**:
One step of a driven run, owned by the skill that already holds its judgment. The driver contributes the brief and the gate, never the judgment.
_Avoid_: stage, step, task

**Brief**:
The explicit inputs a delegate is given. Inherited conversation history is never a brief.
_Avoid_: prompt, context, instructions

**Residue**:
The conflicts between a ticket, a design and the code that documented precedence does not settle. The only conflicts a run asks a human about.
_Avoid_: open questions, blockers, ambiguities

**Reconcile gate**:
The point before implementation where a run stops until the residue is answered. Distinct from a gate ledger, which decides whether finished work is done.
_Avoid_: checkpoint, approval, sign-off

**Takeable**:
A ticket a run may start now: unstarted, every blocker complete, no open PR naming it, and carrying the agent label. The label is a veto, never a trigger — it does not discriminate between a ticket that is ready and one already finished.
_Avoid_: ready, eligible, unblocked, actionable

**Wave**:
A set of tickets an epic body declares can run together. The **backbone** wave invents the shared files and runs serial; a **consumer** wave adds inside its own folders and runs in parallel. An epic that declares no waves runs serial.
_Avoid_: batch, group, tranche, layer

**Park**:
To stop one ticket on a question or a broken allowlist and let the rest of the run continue. A parked session resumes with its context intact, so it costs one round trip rather than a re-run.
_Avoid_: pause, block, defer, hold

**Unasserted**:
A state that was screenshotted with no assertion spec. A third outcome beside pass and fail, never reported as either.
_Avoid_: untested, skipped, n/a

### Review

**Contract**:
The single ticket a diff is judged against. Its comments extend it. A design doc, an ADR, and an RFC never extend it.
_Avoid_: spec, requirements, ticket scope

**Ledger row**:
One requirement of the contract, carrying the ticket text it quotes. The unit a review reports on.
_Avoid_: acceptance criterion, AC, requirement

**Prohibition row**:
A ledger row that states what the diff must not do.
_Avoid_: negative requirement, non-goal

**Anchor**:
A `file:line` inside the reviewed diff that proves a ledger row is met. A line the diff did not touch is not an anchor.
_Avoid_: evidence, reference, proof

**Stray**:
A change the contract does not ask for and nothing defends. It blocks.
_Avoid_: scope creep, extra work, drive-by

**Other-ticket stray**:
A stray whose scope belongs to a different ticket, named. It blocks like any other stray.
_Avoid_: cross-ticket work, mixed PR

**Implied**:
A change the contract does not ask for, that a named ADR, RFC, or design-doc line requires. It does not block.
_Avoid_: necessary change, incidental

**Ambiguous**:
A change the contract does not ask for, where one ticket line has two quoted readings and the change satisfies one. The ticket is the defect. It does not block.
_Avoid_: unclear ticket, judgement call, grey area

**Declared deferral**:
A statement in a PR body or commit that names which ledger row is postponed and which ticket takes it. Nothing else defers a row.
_Avoid_: partial, WIP, follow-up

**Verdict**:
The single outcome of a review: `BLOCK`, `PASS_WITH_NOTES`, `PASS`, or `NO_CONTRACT`.
_Avoid_: score, grade, status
