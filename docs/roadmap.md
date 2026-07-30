# Roadmap

The roadmap is evidence driven. V1 first establishes whether a small, sequential,
least-privilege workflow can complete useful repository work safely and repeatably.
Dates or feature novelty alone do not justify expanding the trust boundary.

## Included in V1

- Explicit single-task and sequential GitHub Project backlog modes.
- Separate orchestrator, implementer, reviewer, and researcher roles.
- Least-privilege tool and GitHub operation boundaries.
- Issue-to-branch-to-pull-request-to-squash-merge lifecycle.
- Fresh independent review with stable findings and at most three fix rounds.
- Local focused and final verification with exact execution evidence.
- Required CI observation and at most two CI-fix rounds.
- Inspect-first repository setup with delegated edits and fresh review.
- A small project configuration for verified commands, purposeful guidance paths,
  optional Project mappings, and squash policy.
- Generic issue, pull request, and repository guidance templates.
- Distribution and project validators for Node.js 20 or later.
- Focused skills for Node setup, change verification, dependency upgrades, and Nx
  impact analysis.

## Deferred from V1

- Parallel issue execution, distributed locks, and multi-agent scheduling.
- Persistent orchestration databases, dashboards, queues, and custom web services.
- Automatic creation or mutation of GitHub Projects, fields, branch protection, CI,
  labels, or repository policy.
- Automatic resolution of ambiguous Project mappings or conflicting active work.
- Administrative merges, force pushes, deployment, rollback, and secret management.
- Unbounded retries, self-approval, review bypass, and CI bypass.
- Broad project generators and language-specific setup beyond evidence-backed Node
  and Nx procedures.
- A larger project schema for additional command types, architecture labels, or
  runtime state.
- Automatic dependency update campaigns or repository-wide modernization.

## Pilot metrics

Collect evidence per task without recording secrets or prompt contents:

- completion outcome: merged, no ready work, or blocked;
- lifecycle stage and category of every blocker;
- elapsed time from ready to active, pull request, and merge;
- number of implementation handoffs, review-fix rounds, and CI-fix rounds;
- first-review pass rate and recurring finding categories;
- focused and final checks requested, executed, skipped, failed, and rerun;
- CI failures attributable to the change versus infrastructure;
- manual interventions, permission denials, and Project status corrections;
- merge conflicts, reopened issues, reverts, and post-merge defects;
- backlog wait time and ready-item count during sequential execution.

Retain issue, pull request, check-run, and Project transition links as the audit
trail. Review aggregate trends across repositories; do not optimize from one unusual
task or use task count alone as a quality measure.

## Evidence-based upgrade triggers

An upgrade proposal should cite repeated pilot evidence, identify the current safe
workaround and its cost, define the smallest change, and state a rollback criterion.
Use these triggers:

- Consider concurrency only when sustained ready-work wait time is the limiting
  factor across multiple pilots, tasks are demonstrably independent, and branch,
  Project, and merge collision controls can be tested before widening execution.
- Add persistent resume state only when interruptions repeatedly require costly or
  error-prone reconstruction that cannot be resolved from Git, issues, pull
  requests, checks, and Project history.
- Automate Project or repository setup only when the same verified manual action is
  a frequent blocker across repositories and the automation can remain idempotent,
  previewable, least privilege, and reversible.
- Expand the project schema only when multiple repositories need the same stable
  datum, no existing source is authoritative, and duplication and migration costs
  are documented.
- Add a language or ecosystem skill only when repeated tasks show a distinct,
  evidence-backed procedure that generic repository inspection handles poorly.
- Change retry limits only when round-by-round evidence shows that the current limit,
  rather than unclear requirements or low-quality fixes, blocks otherwise safe work.
- Add permissions only when a required V1 transition repeatedly fails for that exact
  operation and repository controls still prevent broader or administrative access.

Every upgrade should be piloted in single mode first. Promote it to backlog mode only
after successful review, validation, recovery testing, and comparison with the V1
baseline. Remove or roll back features that increase unsafe actions, post-merge
defects, unexplained retries, or manual recovery without a compensating benefit.
