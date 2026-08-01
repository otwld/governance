# Plan Contract Example

```json
{
  "issueDigest": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "summary": "Make result rendering deterministic at the existing rendering seam while preserving its public interface.",
  "steps": [
    {
      "id": "STEP-1",
      "action": "In test/result.test.mjs, add an end-to-end regression through renderResult proving differently inserted keys produce byte-identical lexical output; then update renderResult in src/result.js at its object-entry ordering seam and document ordering in docs/rendering.md.",
      "acceptanceScenarioIds": ["SCN-1"]
    }
  ],
  "validation": [
    {
      "stepId": "STEP-1",
      "commands": ["node --test test/result.test.mjs", "npm run check"]
    }
  ],
  "documentation": {
    "actions": ["Document renderResult and the changed ordering callback in src/result.js."],
    "external": ["Update docs/rendering.md with deterministic lexical ordering."],
    "rationale": "The plan changes maintained declarations and a public rendering guarantee."
  },
  "risks": ["Callers that accidentally relied on insertion order will observe corrected output; the regression and documentation make the rule explicit."],
  "compatibility": ["The renderResult signature and return type remain unchanged."],
  "rollback": "Revert the renderer, regression, and documentation together; no persisted or remote state requires reversal."
}
```

The digest is illustrative. A real plan uses the `governance_check`-validated digest
of the exact approved issue and exact repository commands.
