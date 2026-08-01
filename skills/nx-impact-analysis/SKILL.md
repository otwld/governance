---
name: nx-impact-analysis
description: Use when selecting affected Nx projects and targets from the repository's actual graph and comparison range.
license: MIT
compatibility: OpenCode with an installed Nx workspace
---

# Analyze Nx Impact

Confirm the comparison range, package manager, Nx configuration, plugins, inputs, and named targets. Query the installed graph; do not guess project relationships or target names. Run the smallest affected targets that cover the change, then the configured final verification command. Report the range, projects, targets, and exact outcomes.
