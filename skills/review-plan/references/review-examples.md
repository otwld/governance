# Plan Review Examples

```json
{
  "subject": {
    "kind": "plan",
    "digest": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  },
  "context": {
    "issueDigest": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "planDigest": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  },
  "verdict": "CHANGES_REQUIRED",
  "findings": [
    {
      "id": "PLAN-1",
      "severity": "high",
      "location": "steps.STEP-2",
      "evidence": "SCN-3 requires the documented invalid-input result, but STEP-2 changes only src/parser.ts and maps no documentation or public example.",
      "impact": "Implementation can pass internal tests while leaving the maintained contract inaccurate.",
      "correction": "Add the owned public documentation path and its validation to the vertical step, or provide repository evidence that no maintained document describes this behavior."
    }
  ]
}
```

A pass uses the exact plan digest, `"verdict": "PASS"`, and `"findings": []`.
