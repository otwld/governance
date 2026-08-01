# Documentation Examples

## Every changed declaration and variable has an owner

```ts
/** Maximum reconciliation time before remote state is reported as unknown. */
const reconciliationTimeoutMs = 5_000;

/**
 * Returns the capped delay after completed failed attempts.
 * The cap keeps a long-lived worker recoverable while preserving bounded backoff.
 */
function retryDelay(failures: number): number {
  /** Uncapped exponential delay in milliseconds for the current attempt count. */
  const candidateDelayMs = 100 * 2 ** failures;
  return Math.min(30_000, candidateDelayMs);
}
```

Poor alternatives such as `// Set timeout to 5000` and `// Calculate delay` narrate
syntax and do not satisfy the policy.

## Callback documentation

```ts
/** Preserve configured Project order when priority ranks are equal. */
const byProjectOrder = (left: ProjectItem, right: ProjectItem) =>
  left.projectIndex - right.projectIndex;

items.sort(byProjectOrder);
```

An anonymous equivalent still needs a clearly associated owning comment:

```ts
items.sort(
  // Preserve configured Project order when priority ranks are equal.
  (left, right) => left.projectIndex - right.projectIndex,
);
```

`items.filter(isEnabled)` may use an import exception for the imported binding, but a
new or materially changed local `isEnabled` declaration needs its own useful contract.

## One owning comment for syntactic bindings

```ts
/** Canonical issue identity parsed from the approved GitHub URL. */
const { owner, repository, issueNumber } = parseIssueUrl(url);
```

The comment owns all three destructured aliases. It cannot also claim unrelated
variables later in the function.

## JavaScript JSDoc

```js
/**
 * Resolves a project document while preventing traversal through symlinks.
 *
 * @param {string} root Canonical repository root.
 * @param {string} documentPath Slash-separated path from project configuration.
 * @returns {Promise<string>} Canonical path contained by `root`.
 * @throws {Error} If the path is absolute, traverses, or resolves outside `root`.
 */
async function resolveProjectDocument(root, documentPath) {
  // ...
}
```

Parameters are covered by the owning function JSDoc and need no separate comments.

## Test callback and local variable

```ts
test('rejects a document symlink that escapes the repository', async () => {
  /** Sibling fixture crosses the same realpath boundary as a developer-owned file. */
  const outside = await createSiblingFixture();

  /** Validation result expected to identify the escaping link without reading it. */
  const diagnostics = await validateProjectDocument(outside.link);
  assert.match(diagnostics.join('\n'), /escapes repository/);
});
```

The complete test name documents the test callback. Its changed variables still have
useful owners. `/** Test rejection. */` would only repeat the name.

## Historical exclusion

If a changed file contains an untouched helper with no comment, leave it alone. If
the change modifies that helper's behavior or responsibility, document it now. The
boundary is semantic change, not file age or proximity.
