# Verification Contract Example

```json
{
  "issueDigest": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "planDigest": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "changeDigest": "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  "status": "PASS",
  "commands": [
    {
      "command": "node --test test/result.test.mjs",
      "cwd": "/workspace/repo",
      "required": false,
      "exitCode": 0,
      "summary": "1 file, 4 tests passed; deterministic-order regression executed.",
      "testsOrTargets": ["test/result.test.mjs", "SCN-1: renders equivalent maps identically"],
      "skipped": []
    },
    {
      "command": "npm run check",
      "cwd": "/workspace/repo",
      "required": true,
      "exitCode": 0,
      "summary": "24 tests passed and distribution validation completed.",
      "testsOrTargets": ["24 Node tests", "distribution validator"],
      "skipped": []
    }
  ]
}
```

If a required service is unavailable, set the command's `exitCode` to `null`, add a
specific `unavailable` reason, and use `BLOCKED`. If a command exits nonzero, preserve
that command evidence and use `FAIL`; do not rewrite the result as unavailable.
