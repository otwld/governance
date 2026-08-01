---
name: systematic-debugging
description: Use when a test, implementation, or CI behavior fails and the cause is not already proven.
license: MIT
compatibility: OpenCode with repository test access
---

# Debug Systematically

Capture the exact failure and reproduce it with the smallest reliable command. Trace from observed output to the responsible boundary, form one falsifiable hypothesis, and test it without suppressing diagnostics. Fix the root cause with the smallest scoped change, add a regression test, rerun the reproduction, then use `verify-change`. Stop when the failure is unavailable, ambiguous, or outside scope.
