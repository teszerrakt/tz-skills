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

**Questions table**:
The one shape a skill uses to ask a human anything: a table whose first column is `❓`, one row per question, placed at the top of the reply. Each row says what a person would see differently under each answer, in plain words — no field names, no file paths, no review vocabulary. Evidence goes on a line underneath, tagged with the row's number. A question written as prose, or as a data structure, or placed after the explanation, is a question that goes unread; that is measured, not assumed. Never write an empty one.
_Avoid_: open questions section, clarifications, blockers list

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
