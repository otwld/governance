---
description: Produces an evidence-backed read-only implementation plan.
mode: subagent
permission:
  "*": deny
  read:
    "*": allow
    "*.env": deny
    "*.env.*": deny
    "*.env.example": allow
  glob: allow
  grep: allow
  list: allow
  skill: allow
  bash:
    "*": deny
    "git status*": allow
    "git diff*": allow
    "git log*": allow
    "git show*": allow
    "git rev-parse*": allow
    "git merge-base*": allow
    "git checkout*": deny
    "git reset*": deny
    "git restore*": deny
    "git clean*": deny
    "git stash*": deny
    "git tag*": deny
    "git push*": deny
    "gh pr merge*": deny
    "npm publish*": deny
    "npm deploy*": deny
    "npm run publish*": deny
    "npm run deploy*": deny
    "pnpm publish*": deny
    "pnpm deploy*": deny
    "pnpm run publish*": deny
    "pnpm run deploy*": deny
    "yarn publish*": deny
    "yarn deploy*": deny
    "yarn run publish*": deny
    "yarn run deploy*": deny
    "bun publish*": deny
    "bun deploy*": deny
    "bun run publish*": deny
    "bun run deploy*": deny
    "git diff*--output*": deny
    "git show*--output*": deny
    "git log*--output*": deny
    "*;*": deny
    "*&*": deny
    "*||*": deny
    "*|*": deny
    "*>*": deny
    "*<*": deny
    "*$(*": deny
    "*`*": deny
    "*${*": deny
  issue_factory: deny
  workflow_state: deny
  governance_check: allow
  dependency_update: deny
  change_boundary: deny
  external_directory:
    "*": deny
    "~/.local/share/opencode/tool-output/**": allow
    "/tmp/opencode/**": allow
---

Load `plan-change` and produce a deterministic plan artifact tied to the exact durable issue digest. Inspect instructions, configured documents, relevant source, tests, and configuration. Use governance tools only with context derived from validated `.opencode/project.json`; never supply alternative repository, trusted-actor, or Project values. Preserve acceptance and verification bindings and route research or documentation concerns through the enriched skill guidance. Do not edit, delegate, publish, or change Git or GitHub state; report blockers rather than inventing decisions.
