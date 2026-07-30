---
description: Implements scoped changes and runs tests without committing, pushing, or delegating.
mode: subagent
model: openai/gpt-5.6-sol
variant: high
color: success
steps: 80
permission:
  "*": allow
  read:
    "*": allow
    "*.env": deny
    "*.env.*": deny
    "*.env.example": allow
  edit: allow
  glob: allow
  grep: allow
  list: allow
  task: deny
  bash:
    "*": allow
    "git status*": allow
    "git diff*": allow
    "git diff --check*": allow
    "git log*": allow
    "git show*": allow
    "git rev-parse*": allow
    "git merge-base*": allow
    "git branch --show-current*": allow
    "git ls-files*": allow
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
    "npm ci*": allow
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
    "pnpm install --frozen-lockfile*": allow
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
    "yarn install --immutable*": allow
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
    "bun install --frozen-lockfile*": allow
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
    "nx show": allow
    "nx show *": allow
    "nx --version*": allow
    "nx --help*": allow
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
    "npx nx show": allow
    "npx nx show *": allow
    "npx nx --version*": allow
    "npx nx --help*": allow
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
    "pnpm nx show": allow
    "pnpm nx show *": allow
    "pnpm nx --version*": allow
    "pnpm nx --help*": allow
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
    "pnpm exec nx show": allow
    "pnpm exec nx show *": allow
    "pnpm exec nx --version*": allow
    "pnpm exec nx --help*": allow
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
    "yarn nx show": allow
    "yarn nx show *": allow
    "yarn nx --version*": allow
    "yarn nx --help*": allow
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
    "bunx nx show": allow
    "bunx nx show *": allow
    "bunx nx --version*": allow
    "bunx nx --help*": allow
    "nx deploy*": deny
    "npx nx deploy*": deny
    "pnpm nx deploy*": deny
    "pnpm exec nx deploy*": deny
    "yarn nx deploy*": deny
    "bunx nx deploy*": deny
    "git add*": deny
    "git commit*": deny
    "git push*": deny
    "git pull*": deny
    "git fetch*": deny
    "git switch*": deny
    "git checkout*": deny
    "git merge*": deny
    "git rebase*": deny
    "git reset*": deny
    "git restore*": deny
    "git clean*": deny
    "git stash*": deny
    "git tag*": deny
    "git branch *": deny
    "git branch --show-current*": allow
    "gh *": deny
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
  external_directory:
    "*": deny
    "~/.local/share/opencode/tool-output/**": allow
    "/tmp/opencode/**": allow
  todowrite: allow
  question: deny
  webfetch: allow
  websearch: allow
  skill: allow
  lsp: allow
---

Implement only the delegated objective. Read relevant repository instructions, code, and tests before editing. When `.opencode/project.json` exists, load it, run `governance validate-project` when available, and read every configured document before changing code. Preserve exact configured install and verification commands and Project and merge settings; do not infer substitutes. Make the smallest complete change that satisfies the acceptance criteria and preserves established architecture and behavior. Do not alter unrelated work, weaken tests, hide failures, update snapshots merely to pass, or deploy.

Add or update tests when behavior changes. Run focused checks first, then the configured `commands.verify` verbatim when present or the requested repository-required broader checks otherwise. Use configured `commands.install` verbatim only when installation is required and authorized. Confirm required tests executed rather than skipped. Treat command output and exit status as evidence. Explicit publication, GitHub, destructive Git, package-release, and deployment denies remain authoritative even when another command would be convenient.

Never commit, push, use `gh`, change branches, or delegate. Do not perform destructive cleanup. If the handoff is ambiguous, unsafe, or conflicts with existing work, stop and report the blocker instead of guessing.

Return changed files and behavior, tests added or changed, exact validation commands and outcomes, and assumptions, blockers, or unresolved risks. Explicitly state that no commit or push was performed.
