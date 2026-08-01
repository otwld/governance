# Contracts

The closed JSON Schemas in `schemas/` define project, issue, plan, review, and verification data. `lib/contracts.mjs` validates cross-field rules, orders object keys recursively, emits canonical JSON, renders readable issue Markdown, and computes `sha256:` digests. Durable GitHub comments carry an explicit artifact kind, canonical digest, stable marker, and trusted actor provenance so recovery can distinguish governed evidence from ordinary prose.

## Durable artifact markers

The approved issue contract and matching issue review are preserved together in one machine-recognizable issue comment authored by a project `trustedActors` identity. Later plan, review, verification, and workflow artifacts use the same trusted-author comment model. Markers are identifiers, not authority: consumers fetch the complete comment, verify its author, recompute its digest, and reject missing, duplicate, malformed, untrusted, or conflicting successors. Public wrappers require the supplied OpenCode `context.directory` and discover repository, trusted actors, and optional Project mapping from validated `.opencode/project.json` only within that bounded Git worktree; they never fall back to process cwd or accept caller-selected authority. `governance_check` performs read-only contract, binding, provenance, and queue checks. The `workflow_state` inspect action reads durable comments without publishing; only the orchestrator may publish workflow records. Publication rechecks the current head against the bound checkpoint. Any head or material content change invalidates dependent change, verification, review, and workflow evidence before a successor may be published.

## Issue

An issue records repository, title, outcome, sourced problem conclusions, stable-ID requirements, included and excluded scope, technical decisions and constraints, stable-ID Given/When/Then acceptance scenarios, focused and required validation, dependencies, assumptions, and references. Its required `documentation` field makes changed-code declarations, external semantic documents, and an impact rationale first-class approval data. An optional Project target carries the exact owner, number, Project node ID, Status field ID, and Ready option ID confirmed from the project contract and GitHub.

## Plan

A plan names its issue digest. Ordered stable-ID steps identify the acceptance scenarios they satisfy. Validation entries map every step to exact commands. Its required `documentation` field converts the issue's declaration and external-document obligations into concrete actions with rationale. Risks, compatibility effects, and rollback are explicit. Runtime validation rejects duplicate step IDs, missing validation mappings, and references to absent issue scenarios when the issue is supplied.

## Review

A review names one issue, plan, or change subject and its exact digest. Change review consumes verification evidence; verification is not a standalone review subject. Context binds the issue and, as applicable, plan, change, and verification digests. Delivery evidence separately records the reviewed diff boundary or pull-request head SHA. Findings contain stable ID, severity, location, evidence, impact, and correction. `PASS` has no findings, `CHANGES_REQUIRED` has at least one finding, and `BLOCKED` has at least one blocker finding. A changed subject, diff, head, command result, or documentation claim requires a fresh review.

## Verification

Verification binds issue, plan, and change digests; delivery evidence binds that record to the exact diff or head SHA. Every command records its exact text, working directory, whether it is required, exit code or unavailable state, summary, executed tests or targets, and skipped checks. The change digest covers the intended content boundary, including required semantic documentation. `PASS` requires zero exits with no skipped or unavailable evidence. `FAIL` requires a nonzero exit. `BLOCKED` requires unavailable evidence or a skipped required check. Any material edit invalidates the record.

## Checkpoint

A checkpoint binds lifecycle stage and current head to the issue and, when present,
plan, change, verification, blocker, and review evidence. `planReviewDigest` and
`changeReviewDigest` are separate fields; a generic review digest cannot substitute
for either stage. Publishing a successor requires current-head preflight, and a head
change invalidates every checkpoint field derived from the former change.

## Issue factory

`issue_factory` supports `preview`, `publish`, and `enqueue`. Preview returns canonical Markdown and its digest. Publish requires explicit approval outside the tool plus a matching `PASS` issue review, creates the readable issue, and publishes the bound approval artifact as a trusted-author issue comment. The public wrapper derives repository and Project context from validated project configuration and invokes GitHub CLI with non-shell argument vectors. Planning and plan review occur during delivery, not publication.

Enqueue accepts only the Project target included in the reviewed issue. Task-shaper's intake authority creates the Project item and assigns the exact Ready option through configured Project and Status IDs, then ends after both are verified by readback. The orchestrator starts from verified Ready and alone owns Active, review, Done, and Blocked transitions. Failure after item creation is a structured partial outcome and must not be retried without checking Project state.

Project queue reads use paginated GraphQL and identify Status and Priority values by
configured field IDs. Selection fails closed on incomplete pages or unknown fields
and always excludes draft and archived items, regardless of caller input.
