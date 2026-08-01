---
name: systematic-debugging
description: Use when a bug, test, build, performance, intermittent, or CI failure lacks a proven root cause; establish a tight reproduction and evidence before proposing any fix.
license: MIT
compatibility: OpenCode with repository test access
---

# Debug Systematically

## The iron law

```text
NO FIX WITHOUT ROOT-CAUSE INVESTIGATION FIRST.
```

A symptom patch is not diagnosis. Under time pressure, evidence is more important,
not less. Keep an investigation log of commands, outputs, observations, hypotheses,
and discarded explanations so failed probes add knowledge instead of thrash.

## Phase 1: establish the failure and tight loop

Capture the user's exact symptom, expected behavior, first known bad context, full
error/stack/warnings, environment, and recent relevant changes. Build one runnable
command that drives the actual failing path and goes red for that symptom. Prefer,
in order: focused failing test, API/CLI script, deterministic fixture or replay,
minimal harness, differential run, or bounded stress loop.

Tighten the reproduction: remove unrelated setup, make assertions binary, shorten
runtime, and run it repeatedly. A nearby failure is not the bug. A test that errors
because setup is broken is not a valid red. Do not theorize from code alone while a
red-capable loop can still be built.

For intermittent failures, optimize reproduction rate rather than pretending it is
deterministic: record seed, order, concurrency, timing, CPU/load, timezone/locale,
filesystem/network, runtime and dependency state; loop or parallelize within safe
bounds. Preserve both passing and failing traces. Replace guessed sleeps with
[condition-based waiting](references/condition-based-waiting.md) when timing itself
is not the behavior under test.

If reproduction is impossible, gather production/CI evidence or define the exact
instrumentation needed. Stop rather than changing behavior on speculation.

## Phase 2: locate the failing boundary and root source

Read errors completely. Map the path from input to observed output. At each component
boundary capture what enters, exits, and which configuration/environment propagates.
Run once to identify the first boundary where good state becomes bad; then narrow
inside that component. Avoid logs containing secrets or personal data and remove
temporary instrumentation after diagnosis.

When the bad value appears deep in a stack, follow
[root-cause tracing](references/root-cause-tracing.md): ask who supplied it, then who
supplied that input, until reaching the earliest controllable cause. Fixing the final
throw site while preserving the corrupt source is a symptom patch.

## Phase 3: compare patterns and test one hypothesis

Find the closest working example in the same repository and, where relevant, read
the authoritative reference completely. List every difference: input, order, state,
ownership, config, environment, dependency, and timing. Rank plausible hypotheses
by evidence and discriminating power, but test only one at a time.

Write the current probe as:

```text
Hypothesis: <specific root cause>
Because: <observations that predict it>
Probe: <smallest reversible measurement/change>
Expected if true: <observable result>
Expected if false: <different observable result>
```

Change one variable. If false, revert the probe, record the result, and form a new
hypothesis. Do not stack speculative fixes. Say what is not understood and research
it instead of laundering uncertainty into confidence.

## Phase 4: lock the cause down and fix

Create the smallest behavior-level regression test that fails for the established
reason. Watch it fail. Make one scoped fix at the source, not a bundle of cleanup.
Run the tight reproduction, regression, nearby checks, and then `verify-change`.
After the source fix, add proportionate [defense in depth](references/defense-in-depth.md)
only at boundaries where it produces clearer errors or prevents dangerous effects.

Remove diagnostic instrumentation unless it is safe, purposeful observability.
Report root cause, causal chain, reproduction, failed hypotheses, changed behavior,
regression, exact verification evidence, and remaining uncertainty.

## Three-failure architecture escalation

Count attempted fixes, not probes. If three evidence-backed fixes fail, stop before a
fourth. Re-open the causal model and question the architecture when each attempt
reveals new shared state/coupling, requires widening refactors, or moves the symptom.
Escalate with the three hypotheses and outcomes, coupling evidence, and architectural
options. This is not permission for an unapproved redesign.

## Environmental and external conclusions

"Environmental" is a root-cause class only after comparison identifies the causal
difference. Pin or validate required state, improve error handling, or add bounded
retry only for proven transient failures. Retry must have a condition, limit,
backoff where appropriate, and observability; it must not hide deterministic defects.

## Rationalizations to reject

| Rationalization | Evidence response |
| --- | --- |
| "It is obvious; just change it." | State and test the causal hypothesis first. |
| "This is too small for a repro." | A small defect permits a small repro. |
| "CI is flaky." | Measure failure conditions and reproduction rate. |
| "Add a sleep/retry." | Wait on the condition or prove transience. |
| "Change several things to save time." | Then no result identifies the cause. |
| "The reference is long." | Partial pattern knowledge creates false hypotheses. |
| "Write the test after the fix." | Then its ability to catch the bug was not shown. |
| "One more fix." | At three failures, escalate architecture. |

## Blockers and non-goals

Stop for unavailable failure evidence, unsafe reproduction, missing credentials or
services, an out-of-scope root cause, or a required architecture/product decision.
Do not suppress diagnostics, weaken tests, update snapshots blindly, increase
timeouts without causal proof, refactor unrelated code, or claim a root cause from
correlation alone.
