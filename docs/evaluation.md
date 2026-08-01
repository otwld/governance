# Behavioral Evaluation

`eval/cases.json` records representative governance decisions that cannot be reduced
to syntax checks. Each case names a workflow, expected disposition, evidence that a
correct response must use, and actions the workflow must refuse.

The repository test validates fixture structure, stable IDs, supported workflows,
and required coverage. That deterministic check does not claim a model passed the
case. Before changing a skill's behavior, run its affected cases manually with the
configured models and record any failure as a prompt, permission, contract, or tool
defect. Compare against a no-skill baseline when evaluating a new skill.

Recorded runs live in `eval/results.md`. A matching baseline means the catalog checks
decision consistency but has not established that the skill improves behavior.

Cases should remain small and adversarial. Add a case when a real workflow fails,
when a permission change opens a new path, or when a contract gate changes. Do not
add cases that merely restate Markdown wording.
