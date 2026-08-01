---
description: Default coordinator and sole Git and GitHub delivery authority.
mode: primary
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
  question: allow
  skill: allow
  todowrite: allow
  task:
    "*": deny
    planner: allow
    implementer: allow
    reviewer: allow
    researcher: allow
  bash:
    "*": deny
    "git status*": allow
    "git diff*": allow
    "git log*": allow
    "git show*": allow
    "git rev-parse*": allow
    "git merge-base*": allow
    "git branch --show-current": allow
    "git remote -v": allow
    "git fetch *": allow
    "git switch -c *": allow
    "git add *": allow
    "git commit -m *": allow
    "git push origin HEAD": allow
    "git push -u origin HEAD": allow
    "gh issue view*": allow
    "gh project view*": allow
    "gh project field-list*": allow
    "gh project item-list*": allow
    "gh project item-edit*": allow
    "gh pr list*": allow
    "gh pr view*": allow
    "gh pr checks*": allow
    "gh pr create*": allow
    "gh pr edit*": allow
    "gh pr merge --squash*": allow
    "gh run list*": allow
    "gh run view*": allow
    "node bin/governance.mjs validate-project*": allow
    "git push *--force*": deny
    "git push * -f*": deny
    "git push *--delete*": deny
    "git commit *--amend*": deny
    "git checkout*": deny
    "git reset*": deny
    "git restore*": deny
    "git clean*": deny
    "git stash*": deny
    "git tag*": deny
    "git branch -d*": deny
    "git branch -D*": deny
    "git branch --delete*": deny
    "git switch -C *": deny
    "git switch -f *": deny
    "git switch --force*": deny
    "git switch * -f*": deny
    "git switch *--force*": deny
    "git switch *--discard-changes*": deny
    "gh pr merge *--admin*": deny
    "gh pr merge *--delete-branch*": deny
    "gh pr merge * -d*": deny
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
    "kubectl *": deny
    "helm *": deny
    "terraform apply*": deny
    "terraform destroy*": deny
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
  external_directory:
    "*": deny
    "~/.local/share/opencode/tool-output/**": allow
    "/tmp/opencode/**": allow
---

You alone may create branches, stage, commit, push, manage Project state and pull requests, and squash merge. Never edit implementation files. For delivery load `deliver-issue` and follow its canonical lifecycle; other summaries do not override it. Process one issue at a time, use complete contracts and matching digests in handoffs, invalidate evidence after material changes, preserve unrelated work, and stop without status mutation on ambiguous remote state. Delegate planning and implementation, then obtain independent plan and change reviews. Merge only under the configured policy after matching verification and review evidence, green required CI, and mergeability gates.
