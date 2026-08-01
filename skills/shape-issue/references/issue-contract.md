# Issue Contract Example

This example illustrates the exact closed shape. Replace every value with verified
repository evidence; do not copy placeholder decisions into a real issue.

```json
{
  "repository": "owner/repo",
  "title": "Render deterministic result keys",
  "outcome": "Equivalent result values render byte-identical output.",
  "problemEvidence": [
    {
      "source": "src/result.js and test/result.test.mjs",
      "conclusion": "Rendering currently follows insertion order and has no cross-order scenario."
    }
  ],
  "requirements": [
    { "id": "REQ-1", "text": "Render result keys in lexical order." },
    { "id": "REQ-2", "text": "Preserve the public rendering interface." }
  ],
  "scope": {
    "included": ["Result-key ordering", "Regression coverage", "Rendering documentation"],
    "excluded": ["Stored data transformation", "Unrelated serializers"]
  },
  "technicalDirection": {
    "decisions": ["Lexical ordering defines deterministic output."],
    "constraints": ["Do not change the public function signature."],
    "discretion": ["Helper name and internal sorting location."]
  },
  "acceptanceScenarios": [
    {
      "id": "SCN-1",
      "given": "Equivalent values created with different key insertion order",
      "when": "Both values are rendered",
      "then": ["The outputs are byte-identical.", "Keys appear in lexical order."]
    }
  ],
  "validation": {
    "focused": ["node --test test/result.test.mjs"],
    "required": ["npm run check"]
  },
  "documentation": {
    "declarations": ["Document the changed renderResult declaration and ordering callback."],
    "external": ["Update docs/rendering.md with the lexical ordering contract."],
    "rationale": "The change alters a maintained declaration and externally documented output behavior."
  },
  "dependencies": [],
  "assumptions": ["Key comparison uses the repository's existing string semantics."],
  "references": ["docs/rendering.md"],
  "projectTarget": {
    "owner": "owner",
    "number": 7,
    "projectId": "PVT_project",
    "statusFieldId": "PVTSSF_status",
    "readyStatus": "Ready",
    "readyOptionId": "ready_option"
  }
}
```

## Readiness checklist

- One independently valuable outcome; no conjunction hiding a second project.
- Every evidence conclusion is narrower than or equal to its source support.
- Requirement and scenario IDs are unique, stable, and cross-readable.
- Important success, empty, invalid, and compatibility paths are observable.
- Decisions do not consume choices intentionally left to implementation.
- Focused and required commands exist and are non-mutating.
- Documentation impact and Project targeting are explicit.
- `documentation` names declaration and external actions with rationale.
- `projectTarget.readyStatus` and every ID match direct Project read evidence.
