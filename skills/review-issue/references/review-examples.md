# Issue Review Examples

Passing review:

```json
{
  "subject": {
    "kind": "issue",
    "digest": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  },
  "context": {
    "issueDigest": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  },
  "verdict": "PASS",
  "findings": []
}
```

Correction required:

```json
{
  "subject": {
    "kind": "issue",
    "digest": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  },
  "context": {
    "issueDigest": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  },
  "verdict": "CHANGES_REQUIRED",
  "findings": [
    {
      "id": "ISSUE-1",
      "severity": "high",
      "location": "acceptanceScenarios.SCN-2.then",
      "evidence": "The scenario says an invalid key is handled but does not name the observable return or error; src/result.js supports two materially different outcomes.",
      "impact": "Both rejecting and silently omitting the key satisfy the current words.",
      "correction": "State the selected observable invalid-key outcome without prescribing helper structure."
    }
  ]
}
```
