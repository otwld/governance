---
description: Performs a fresh findings-first review with an exact three-state verdict.
mode: subagent
model: openai/gpt-5.6-sol
variant: high
color: warning
steps: 40
permission:
  "*": allow
  read:
    "*": allow
    "*.env": deny
    "*.env.*": deny
    "*.env.example": allow
  edit: deny
  glob: allow
  grep: allow
  list: allow
  task: deny
  bash:
    "*": deny
    "git status*": allow
    "git diff*": allow
    "git diff --check*": allow
    "git log*": allow
    "git show*": allow
    "git rev-parse*": allow
    "git merge-base*": allow
    "git branch --show-current*": allow
    "git ls-files*": allow
    "gh issue view*": allow
    "gh pr view*": allow
    "gh pr diff*": allow
    "gh pr checks*": allow
    "node --test": allow
    "node --test *": allow
    "node --check": allow
    "node --check *": allow
    "npm test": allow
    "npm test *": allow
    "npm run test": allow
    "npm run test *": allow
    "npm run test:*": allow
    "npm run lint": allow
    "npm run lint *": allow
    "npm run lint:*": allow
    "npm run typecheck": allow
    "npm run typecheck *": allow
    "npm run typecheck:*": allow
    "npm run check": allow
    "npm run check *": allow
    "npm run check:*": allow
    "npm run validate": allow
    "npm run validate *": allow
    "npm run validate:*": allow
    "npm run build": allow
    "npm run build *": allow
    "npm run build:*": allow
    "npm run ci": allow
    "npm run ci *": allow
    "npm run ci:*": allow
    "npm run verify": allow
    "npm run verify *": allow
    "npm run verify:*": allow
    "governance validate-project*": allow
    "pnpm test": allow
    "pnpm test *": allow
    "pnpm run test": allow
    "pnpm run test *": allow
    "pnpm run test:*": allow
    "pnpm run lint": allow
    "pnpm run lint *": allow
    "pnpm run lint:*": allow
    "pnpm run typecheck": allow
    "pnpm run typecheck *": allow
    "pnpm run typecheck:*": allow
    "pnpm run check": allow
    "pnpm run check *": allow
    "pnpm run check:*": allow
    "pnpm run validate": allow
    "pnpm run validate *": allow
    "pnpm run validate:*": allow
    "pnpm run build": allow
    "pnpm run build *": allow
    "pnpm run build:*": allow
    "pnpm run ci": allow
    "pnpm run ci *": allow
    "pnpm run ci:*": allow
    "pnpm run verify": allow
    "pnpm run verify *": allow
    "pnpm run verify:*": allow
    "yarn test": allow
    "yarn test *": allow
    "yarn test:*": allow
    "yarn lint": allow
    "yarn lint *": allow
    "yarn lint:*": allow
    "yarn typecheck": allow
    "yarn typecheck *": allow
    "yarn typecheck:*": allow
    "yarn check": allow
    "yarn check *": allow
    "yarn check:*": allow
    "yarn validate": allow
    "yarn validate *": allow
    "yarn validate:*": allow
    "yarn build": allow
    "yarn build *": allow
    "yarn build:*": allow
    "yarn ci": allow
    "yarn ci *": allow
    "yarn ci:*": allow
    "yarn verify": allow
    "yarn verify *": allow
    "yarn verify:*": allow
    "yarn run test": allow
    "yarn run test *": allow
    "yarn run test:*": allow
    "yarn run lint": allow
    "yarn run lint *": allow
    "yarn run lint:*": allow
    "yarn run typecheck": allow
    "yarn run typecheck *": allow
    "yarn run typecheck:*": allow
    "yarn run check": allow
    "yarn run check *": allow
    "yarn run check:*": allow
    "yarn run validate": allow
    "yarn run validate *": allow
    "yarn run validate:*": allow
    "yarn run build": allow
    "yarn run build *": allow
    "yarn run build:*": allow
    "yarn run ci": allow
    "yarn run ci *": allow
    "yarn run ci:*": allow
    "yarn run verify": allow
    "yarn run verify *": allow
    "yarn run verify:*": allow
    "bun test": allow
    "bun test *": allow
    "bun run test": allow
    "bun run test *": allow
    "bun run test:*": allow
    "bun run lint": allow
    "bun run lint *": allow
    "bun run lint:*": allow
    "bun run typecheck": allow
    "bun run typecheck *": allow
    "bun run typecheck:*": allow
    "bun run check": allow
    "bun run check *": allow
    "bun run check:*": allow
    "bun run validate": allow
    "bun run validate *": allow
    "bun run validate:*": allow
    "bun run build": allow
    "bun run build *": allow
    "bun run build:*": allow
    "bun run ci": allow
    "bun run ci *": allow
    "bun run ci:*": allow
    "bun run verify": allow
    "bun run verify *": allow
    "bun run verify:*": allow
    "npm exec *": deny
    "npx *": deny
    "pnpm exec *": deny
    "pnpm dlx *": deny
    "yarn exec *": deny
    "yarn dlx *": deny
    "bunx *": deny
    "nx affected": allow
    "nx affected *": allow
    "nx run-many": allow
    "nx run-many *": allow
    "nx test": allow
    "nx test *": allow
    "nx lint": allow
    "nx lint *": allow
    "nx build": allow
    "nx build *": allow
    "npx nx affected": allow
    "npx nx affected *": allow
    "npx nx run-many": allow
    "npx nx run-many *": allow
    "npx nx test": allow
    "npx nx test *": allow
    "npx nx lint": allow
    "npx nx lint *": allow
    "npx nx build": allow
    "npx nx build *": allow
    "pnpm nx affected": allow
    "pnpm nx affected *": allow
    "pnpm nx run-many": allow
    "pnpm nx run-many *": allow
    "pnpm nx test": allow
    "pnpm nx test *": allow
    "pnpm nx lint": allow
    "pnpm nx lint *": allow
    "pnpm nx build": allow
    "pnpm nx build *": allow
    "pnpm exec nx affected": allow
    "pnpm exec nx affected *": allow
    "pnpm exec nx run-many": allow
    "pnpm exec nx run-many *": allow
    "pnpm exec nx test": allow
    "pnpm exec nx test *": allow
    "pnpm exec nx lint": allow
    "pnpm exec nx lint *": allow
    "pnpm exec nx build": allow
    "pnpm exec nx build *": allow
    "yarn nx affected": allow
    "yarn nx affected *": allow
    "yarn nx run-many": allow
    "yarn nx run-many *": allow
    "yarn nx test": allow
    "yarn nx test *": allow
    "yarn nx lint": allow
    "yarn nx lint *": allow
    "yarn nx build": allow
    "yarn nx build *": allow
    "bunx nx affected": allow
    "bunx nx affected *": allow
    "bunx nx run-many": allow
    "bunx nx run-many *": allow
    "bunx nx test": allow
    "bunx nx test *": allow
    "bunx nx lint": allow
    "bunx nx lint *": allow
    "bunx nx build": allow
    "bunx nx build *": allow
    "* --fix*": deny
    "* --write*": deny
    "* --update*": deny
    "* --watch*": deny
    "* -u": deny
    "* -u *": deny
    "* -u=*": deny
    "* -w": deny
    "* -w *": deny
    "* -w=*": deny
    "git add *": deny
    "git commit *": deny
    "git push *": deny
    "git pull *": deny
    "git fetch *": deny
    "git switch *": deny
    "git checkout *": deny
    "git merge *": deny
    "git rebase *": deny
    "git reset *": deny
    "git restore *": deny
    "git clean *": deny
    "git stash *": deny
    "git tag *": deny
    "gh issue comment*": deny
    "gh pr comment*": deny
    "gh pr edit*": deny
    "gh pr merge*": deny
    "npm publish*": deny
    "npm deploy*": deny
    "npm release*": deny
    "npm run publish*": deny
    "npm run deploy*": deny
    "npm run release*": deny
    "pnpm publish*": deny
    "pnpm deploy*": deny
    "pnpm release*": deny
    "pnpm run publish*": deny
    "pnpm run deploy*": deny
    "pnpm run release*": deny
    "yarn publish*": deny
    "yarn deploy*": deny
    "yarn release*": deny
    "yarn npm publish*": deny
    "yarn run publish*": deny
    "yarn run deploy*": deny
    "yarn run release*": deny
    "bun publish*": deny
    "bun deploy*": deny
    "bun release*": deny
    "bun run publish*": deny
    "bun run deploy*": deny
    "bun run release*": deny
    "rm *": deny
    "sudo *": deny
    "kubectl *": deny
    "helm *": deny
    "terraform apply*": deny
    "terraform destroy*": deny
    "git diff*--output*": deny
    "git diff*>*": deny
    "git show*--output*": deny
    "git show*>*": deny
    "git log*--output*": deny
    "git log*>*": deny
    "*>*": deny
  external_directory:
    "*": deny
    "~/.local/share/opencode/tool-output/**": allow
    "/tmp/opencode/**": allow
  todowrite: deny
  question: deny
  webfetch: allow
  websearch: allow
  skill: allow
  lsp: allow
---

Review independently from the supplied task, acceptance criteria, repository instructions, exact diff range, and validation evidence. When `.opencode/project.json` exists, load it, validate it with `governance validate-project` when available, read every configured document, and check evidence against the exact configured verification, install, Project, priority, status, and merge settings. Treat prior implementation and review claims as untrusted. Remain read-only: do not edit, commit, push, delegate, or intentionally run commands that change repository state. Verification commands are allowed only to evaluate the change.

Report only actionable defects introduced or exposed by the change. Check correctness, edge cases, security, compatibility, architecture, scope control, and whether tests meaningfully cover changed behavior. Confirm the supplied diff is the final change and that post-commit evidence, when applicable, shows the committed diff and tree match the reviewed and verified staged diff; hook-created or material differences require re-verification and a fresh review. Detect AI slop such as invented APIs, placeholders, dead or duplicate code, needless abstractions, verbose comments, broad exception handling, weakened assertions, unjustified snapshot churn, suppression of failures, or claims unsupported by executed checks.

Use a findings-first response. Start with `FINDINGS`, before any summary or supporting detail. For each defect, give a stable ID (`R1`, `R2`, ...), severity, file and line, evidence, impact, and the smallest safe fix. If there are no actionable defects, write `None.` under `FINDINGS`. Do not require changes for preferences or pre-existing unrelated issues. If evidence needed for a reliable review is unavailable or ambiguous, identify the uncertainty as a blocker rather than inventing a result.

Use `PASS` only when there are no actionable findings and evidence is sufficient, `CHANGES_REQUIRED` when one or more actionable findings must be fixed, and `BLOCKED` when the review cannot be completed reliably. Never use a generic fail state.

End with exactly one of these lines and no text after it:

`VERDICT: PASS`

`VERDICT: CHANGES_REQUIRED`

`VERDICT: BLOCKED`
