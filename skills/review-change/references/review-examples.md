# Change Review Examples

```json
{
  "subject": {
    "kind": "change",
    "digest": "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
  },
  "context": {
    "issueDigest": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "planDigest": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "changeDigest": "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    "verificationDigest": "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
  },
  "verdict": "CHANGES_REQUIRED",
  "findings": [
    {
      "id": "CHANGE-1",
      "severity": "high",
      "location": "src/result.js:42",
      "evidence": "The comparator returns a boolean, while Array.prototype.sort expects a negative, zero, or positive number; equal and descending keys are therefore ordered inconsistently.",
      "impact": "SCN-1 can still produce non-deterministic output for three or more keys.",
      "correction": "Use the repository's numeric lexical comparator and add a three-key regression through renderResult."
    }
  ]
}
```

Malformed-boundary example: use `subject.kind: "change"`, the claimed digest in
`subject.digest`, a `BLOCKED` verdict, and a blocker finding explaining which base/head/tree or digest
cannot be established. Never substitute a nearby diff.
