# Terminal Readiness Report

Print this report after every run. Use plain terminal Markdown; produce a self-contained
HTML version only when the user asks. Do not add a promotional badge or publish Git state.

1. **Repository profile and evidence:** repository identity or local-only fallback,
   Node/package-manager/runtime/framework/repository type, scripts and CI, workspace
   relationships, GitHub sample bounds, and evidence paths or URLs.
2. **Consistency findings:** contradictions, drift, and duplicates with affected paths and
   the evidence that establishes each finding.
3. **Asset status:** group the inventory by `Ready`, `Needs work`, `Missing`,
   `Not applicable`, and `Blocked`. Give each row a short reason and evidence.
4. **Actions:** list created, preservation-first merged, intentionally unmodified,
   excluded, and suggested manual actions. In report-only mode, list proposed actions
   rather than files changed.
5. **Readiness count:** show `Ready / applicable` before and after. Exclude only evidenced
   `Not applicable` assets, retain known-applicable blocked assets in the denominator, and
   report an indeterminate count when applicability cannot be established.
6. **Omissions and blockers:** identify unavailable GitHub evidence, unsafe merges,
   excluded assets, absent release or documentation evidence, and every validation command
   not run. End with exact commands run and their outcomes.
