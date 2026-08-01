---
name: dependency-upgrade
description: Use when making one bounded Node dependency update with authoritative release and compatibility evidence.
license: MIT
compatibility: OpenCode with Node package-manager access
---

# Upgrade a Dependency

Identify the active package manager and exact requested package boundary. Use primary release notes and support matrices, update the manifest and lockfile through the repository's package manager, and make only required compatibility edits. Add regression coverage where behavior changes. Run focused checks and `verify-change`. Report source URLs, changed packages, commands, and unresolved risk.
