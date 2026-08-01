---
description: Runs a fresh read-only review of an exact issue, plan, or change subject.
agent: reviewer
---

Independently review this exact subject: $ARGUMENTS

Route issues to `review-issue`, plans to `review-plan`, and changes to `review-change`. A change review requires and consumes its bound verification evidence; verification is not a standalone review subject. Require the complete artifact, digest, and diff or head boundary. If the subject kind or boundary is ambiguous, return `BLOCKED` without guessing.
