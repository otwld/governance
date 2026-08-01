# Contracts

The closed JSON Schemas in `schemas/` define project, issue, plan, review, and verification data. `lib/contracts.mjs` validates cross-field rules, orders object keys recursively, emits canonical JSON, renders readable issue Markdown, and computes `sha256:` digests.

## Issue

An issue records repository, title, outcome, sourced problem conclusions, stable-ID requirements, included and excluded scope, technical decisions and constraints, stable-ID Given/When/Then acceptance scenarios, focused and required validation, dependencies, assumptions, and references. An optional Project target carries the exact owner, number, Project node ID, Status field ID, and Ready option ID confirmed from the project contract and GitHub.

## Plan

A plan names its issue digest. Ordered stable-ID steps identify the acceptance scenarios they satisfy. Validation entries map every step to exact commands. Risks, compatibility effects, and rollback are explicit. Runtime validation rejects duplicate step IDs, missing validation mappings, and references to absent issue scenarios when the issue is supplied.

## Review

A review names its subject kind and digest. Findings contain stable ID, severity, location, evidence, impact, and correction. `PASS` has no findings, `CHANGES_REQUIRED` has at least one finding, and `BLOCKED` has at least one blocker finding.

## Verification

Verification binds both subject and change digests. Every command records its exact text, working directory, whether it is required, exit code or unavailable state, summary, executed tests or targets, and skipped checks. `PASS` requires zero exits with no skipped or unavailable evidence. `FAIL` requires a nonzero exit. `BLOCKED` requires unavailable evidence or a skipped required check.

## Issue factory

`issue_factory` supports `preview`, `publish`, and `enqueue`. Preview returns canonical Markdown and its digest. Publish requires explicit approval outside the tool plus a matching `PASS` issue review, invokes GitHub CLI with a non-shell argument vector, and accepts only a URL belonging to the issue repository. Planning and plan review occur during delivery, not publication.

Enqueue accepts only the Project target included in the reviewed issue. It adds the published issue URL, reads the returned item ID, and sets the exact Ready option through the approved Project and Status field IDs. Failure after item creation is a structured partial outcome and must not be retried without checking Project state.
