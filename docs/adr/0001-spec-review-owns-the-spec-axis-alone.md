# spec-review owns the spec axis alone

`mattpocock-skills:code-review` reviews a diff on two axes at once, Standards and Spec, and its Spec sub-agent already reports missing requirements and scope creep. We built `spec-review` beside it rather than extending it, because the Spec axis here needs the tracker: it fetches the Linear ticket and its comments, layers the design doc, ADRs, and RFCs behind it, and posts an ambiguity back to the ticket instead of to the PR. A wrapper cannot add those inputs to a sub-agent it does not write, and a fork would carry a Standards axis that `/code-review` (CodeRabbit) already covers.

Two consequences follow. `spec-review` never comments on code quality, so a clean `PASS` says nothing about the code itself. And it sets `disable-model-invocation: true`: `/code-review` must keep firing on its own, and two review skills that both fire automatically make the model pick one at random.
