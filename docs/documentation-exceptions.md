# Changed-Code Documentation Exceptions

This inventory applies only to the current uncommitted maintained JavaScript/MJS
diff. Every pointer is an exact current line or inclusive import range. The reason
column names one canonical exception from `skills/document-code/references/policy.md`.

## Imports and re-exports

| Exact pointer | Reason |
| --- | --- |
| `lib/contracts.mjs:1` | Import; semantics are owned by the importing declarations. |
| `lib/issue-factory.mjs:1-3` | Imports; semantics are owned by the importing declarations. |
| `lib/validation.mjs:1-3`, `lib/validation.mjs:311` | Imports/re-export; semantics are owned by the importing/exported declarations. |
| `lib/change-boundary.mjs:1` | Import; semantics are owned by the importing declaration. |
| `lib/dependency-update.mjs:1-2` | Imports; semantics are owned by the importing declarations. |
| `lib/governance-check.mjs:1-3` | Imports; semantics are owned by the importing declarations. |
| `lib/project-context.mjs:1-3` | Exact inclusive import block; semantics are owned by the importing declarations. |
| `lib/workflow-state.mjs:1-2` | Imports; semantics are owned by the importing declarations. |
| `tools/change_boundary.js:1-3` | Imports; semantics are owned by the wrapper contract. |
| `tools/dependency_update.js:1-3` | Imports; semantics are owned by the wrapper contract. |
| `tools/governance_check.js:1-3` | Imports; semantics are owned by the wrapper contract. |
| `tools/issue_factory.js:1-3` | Imports; semantics are owned by the wrapper contract. |
| `tools/workflow_state.js:1-3` | Imports; semantics are owned by the wrapper contract. |
| `test/change-boundary.test.mjs:1-3` | Imports; semantics are owned by the test module. |
| `test/cli.test.mjs:1-3` | Imports; semantics are owned by the test module. |
| `test/contracts-project.test.mjs:1-7` | Exact inclusive import block; semantics are owned by the test module. |
| `test/dependency-update.test.mjs:1-6` | Imports; semantics are owned by the test module. |
| `test/distribution.test.mjs:1-6` | Imports; semantics are owned by the test module. |
| `test/evaluation.test.mjs:1-3` | Imports; semantics are owned by the test module. |
| `test/governance-check.test.mjs:1-4` | Imports; semantics are owned by the test module. |
| `test/issue-factory.test.mjs:1-4` | Imports; semantics are owned by the test module. |
| `test/project-context.test.mjs:1-6` | Exact inclusive import block; semantics are owned by the test module. |
| `test/project-items.test.mjs:1-3` | Exact inclusive import block; semantics are owned by the test module. |
| `test/workflow-state.test.mjs:1-4` | Imports; semantics are owned by the test module. |

`lib/project-items.mjs` has no import or re-export exception.

## Parameters covered by their owner

Each listed line contains function, method, test, or callback parameters whose
semantics are covered by that line's documented owning declaration or behavioral
test contract.

| Exact pointer(s) | Reason |
| --- | --- |
| `lib/contracts.mjs:4,6,18,29,34,35,43,52,57,69,79,89,92,97,104,121,136,141,147,153,159,169,171,172,173,182,183,189,202,208,214,219,227,231,235,237,252,253,254,258,263,268,273,274,279,284,288,303,306,310,315,320,328,332,337,344,345,349,353,354,355,361,375,383,401` | Each exact function/callback parameter line is covered by its owning contract-validation, digest, rendering, or extraction declaration. |
| `lib/issue-factory.mjs:6,14,21,29,35,40,63,94,115` | Exact function or callback parameters; semantics are documented by the owning publication, authentication, or Project-readback declaration. |
| `lib/validation.mjs:6,8,10,13,27,28,39,42,43,48,56,62,88,102,120,125,143,144,156,192,202,204,221,224,232,233,244,258,260,291` | Parameters are covered by the owning parser, schema, roster, permission, or project-validation declaration. |
| `lib/change-boundary.mjs:4,11,17` | Parameters are covered by the owning subprocess, error, or staged-boundary declaration. |
| `lib/dependency-update.mjs:12,15,21,31,39,47,52,62,67` | Exact function parameters; semantics are documented by the owning package-manager, scoped selector, override-map, manifest, lockfile, or update declaration. |
| `lib/governance-check.mjs:9,14,22,29,36,45,48,63,67,71,86,90,104,111,118,120,127,142,145,150,155,171` | Exact function or callback parameters; semantics are documented by the owning read-only, provenance, normalization, or queue declaration. |
| `lib/project-context.mjs:6,11,18,38,43,44` | Each exact function/loop/callback parameter line is covered by the bounded-root or path-containment owner. |
| `lib/project-items.mjs:5,10,15,22,35,40` | Each exact function/loop/callback parameter line is covered by the pagination, failure, or field-ID lookup owner. |
| `lib/workflow-state.mjs:14,19,27,34,41,66,68,72,78,92,109,117,132,139,159,217,229,235,285` | Exact function or callback parameters; semantics are documented by the owning marker, chain, provenance, inspect, or publish declaration. |
| `tools/change_boundary.js:6,18,23` | Parameters are covered by the fixed-worktree subprocess and required-context wrapper declarations. |
| `tools/dependency_update.js:6,13,27,32` | Parameters are covered by the credential, fixed-worktree subprocess, and required-context wrapper declarations. |
| `tools/governance_check.js:6,13,28,35` | Parameters are covered by the redaction, read-only subprocess, and required-context wrapper declarations. |
| `tools/issue_factory.js:6,13,32,39` | Parameters are covered by the redaction, publication subprocess, and required-context wrapper declarations. |
| `tools/workflow_state.js:6,13,32,37` | Parameters are covered by the redaction, comment subprocess, and required-context wrapper declarations. |
| `test/change-boundary.test.mjs:6,8,11,14,20,23` | Test/spawn parameters are covered by the staged-boundary behavioral test owners. |
| `test/cli.test.mjs:8,11,19,27` | Test and extraction parameters are covered by the CLI roster/validation test owners. |
| `test/contracts-project.test.mjs:34,39,48,49,50,58,59,60,62,68,69,70,71,74,78,106,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,134,135,136,137,138,139,140,141,147,148,149,150,151,152,153,154,156,158,161,162,163,164,168,187,188,194,205,211,218,220,222,227,239,240,241,243` | Each exact test/helper/callback parameter line is covered by its project or contract behavioral owner. |
| `test/dependency-update.test.mjs:9,11,22,23,27,36,40,52,56,62,67,70,73,78,90,106,107,113,120,121,131,175,185,195` | Exact test, helper, spawn, cleanup, or matrix callback parameters are covered by their dependency-boundary behavioral owners. |
| `test/distribution.test.mjs:12,26,36,41,46,51,71,88,145,169,178,206,286,312,313,320` | Exact helper/test/callback parameters are covered by their permission, schema, documentation, or fixture owners. |
| `test/evaluation.test.mjs:11,29,30,31,32` | Test/callback parameters are covered by the evaluation-catalog structural owner. |
| `test/governance-check.test.mjs:28,33,38,47,52,58,63,78,88,91,98` | Exact test/helper/spawn parameters are covered by their read-only, provenance, or queue behavioral owners. |
| `test/issue-factory.test.mjs:28,33,38,41,50,53,70,72,79,85,88,91,93,98,102,114,118,120,126,128,131,136,139` | Exact test/helper/spawn/assertion callback parameters are covered by their preview, publication, authentication, or enqueue behavioral owners. |
| `test/project-context.test.mjs:9,11,27,32,34,42,43` | Each exact test, cleanup, or loop parameter line is covered by the bounded-discovery or public-schema behavioral owner. |
| `test/project-items.test.mjs:6,10,19,23,28` | Each exact test, spawn, or assertion callback parameter line is covered by the pagination or immutable-field behavioral owner. |
| `test/workflow-state.test.mjs:32,37,47,50,62,73,79,80,81,89,101,107,110,113,118,128,129,135,142,149,151,155,160,162,167,174,179,186` | Exact helper, test, map, find, or spawn callback parameters are covered by their chain, provenance, ordering, publication, or race behavioral owners. |

## Destructuring aliases

Each pointer is an exact destructuring binding; names and semantics are covered by
the owning declaration identified in the preceding section.

| Exact pointer(s) | Reason |
| --- | --- |
| `lib/contracts.mjs:61,97,104,121,147,153,159,172,183,214,237,383` | Exact diagnostic index/value and repository aliases are covered by their validators/extractor. |
| `lib/validation.mjs:10,104,105,107,241,267,301` | Diagnostic, manifest, document, and option aliases are covered by their validators. |
| `lib/dependency-update.mjs:21,34,55` | Exact manager/package, manager/lockfile, and selector/nested aliases are covered by argv construction, discovery, and recursive override inspection. |
| `test/dependency-update.test.mjs:9,177` | Exact fixture-option and manager/descriptor/runtime aliases are covered by their helper and integrity-pin matrix owners. |
| `lib/governance-check.mjs:45,50,120,127,130,171` | Exact provenance, option, queue, and item aliases are covered by their owners. |
| `lib/project-context.mjs:38` | Exact diagnostic path/message aliases are covered by validated-config rendering. |
| `lib/workflow-state.mjs:149,184,208` | Chain key/digest aliases are covered by chain validation. |
| `tools/change_boundary.js:9` | Process result aliases are covered by the subprocess owner. |
| `tools/dependency_update.js:16` | Process result aliases are covered by the subprocess owner. |
| `tools/governance_check.js:16` | Process result aliases are covered by the subprocess owner. |
| `tools/issue_factory.js:16` | Process result aliases are covered by the subprocess owner. |
| `tools/workflow_state.js:16` | Process result aliases are covered by the subprocess owner. |
| `test/contracts-project.test.mjs:156` | Exact matrix kind/builder aliases are covered by the malformed-value test owner. |
| `test/distribution.test.mjs:56,74,135,297` | Exact tool/agent/skill/source aliases are covered by their matrix test owners. |
| `test/evaluation.test.mjs:18` | Evaluation index/value aliases are covered by the catalog test owner. |

## Loop and catch bindings

Every pointer is an exact loop or catch binding. Loop values are covered by the
owning collection contract; catch values are covered by the owning failure contract.

| Exact pointer(s) | Reason |
| --- | --- |
| `lib/contracts.mjs:23,24,61,75,97,104,121,136,147,153,159,172,173,183,202,214,219,235,237,263,273,274,279,284,332` | Each exact loop binding is covered by its owning contract validator. |
| `lib/issue-factory.mjs:59,66,72,104,111` | Exact catch bindings are covered by authentication, create, comment, add, and status-update stage outcomes. |
| `lib/validation.mjs:19,31,50,51,73,84,94,95,104,105,107,111,128,137,152,157,166,168,176,183,193,194,202,241,255,258,260,267,301` | Loop bindings are covered by parser, roster, schema, permission, or project validators. |
| `lib/validation.mjs:58,296` | Exact catch bindings are covered by malformed JSON and project-config read diagnostics. |
| `lib/change-boundary.mjs:39` | Exact catch binding is covered by staged-boundary unknown-outcome handling. |
| `lib/dependency-update.mjs:34,55,82,106,115,124` | Exact loop and bound catch variables are covered by lockfile discovery, recursive selector inspection, manifest reads, and subprocess failure handling. |
| `lib/governance-check.mjs:50,76,130` | Exact loop and bound catch variables are covered by approval and queue normalization/failure contracts. |
| `lib/governance-check.mjs:76` | Exact catch binding is covered by the GitHub unknown-outcome contract. |
| `lib/project-context.mjs:18` | Exact ancestor-search loop binding is covered by bounded worktree discovery. |
| `lib/project-context.mjs:36,52` | Exact catch bindings are covered by config-read and target-resolution rejection contracts. |
| `lib/project-items.mjs:10,22` | Exact page and node loop bindings are covered by bounded pagination and uniqueness contracts. |
| `lib/project-items.mjs:15` | Exact page-fetch catch binding is covered by unknown-outcome classification. |
| `lib/workflow-state.mjs:111,112,149,184,208` | Loop bindings are covered by trusted-comment and chain traversal. |
| `lib/workflow-state.mjs:220,257,275` | Exact catch bindings are covered by issue-read, actor-read, and publication unknown-outcome contracts. |
| `test/cli.test.mjs:20` | Command loop binding is covered by the CLI validation matrix. |
| `test/contracts-project.test.mjs:50,58,59,60,156,218,239,243` | Exact loop bindings are covered by their project/contract invalid-input matrices. |
| `test/dependency-update.test.mjs:91,99,116,142,166,177` | Exact loop bindings are covered by dependency-section, unsupported-declaration, rejected-input, selector, and integrity-pin matrices. |
| `test/distribution.test.mjs:17,28,56,58,65,74,80,91,114,123,135,147,149,150,151,162,170,181,228,231,239,252,289,290,297,304,314` | Exact loop bindings are covered by permission, command, docs, schema, and fixture matrices. |
| `test/evaluation.test.mjs:18,29` | Loop bindings are covered by catalog-shape and coverage-prefix matrices. |
| `test/project-context.test.mjs:34,42,43` | Exact loop bindings are covered by public-schema and cwd-fallback matrices. |
| `test/workflow-state.test.mjs:67,100` | Exact loop bindings are covered by artifact-kind and invalid-chain matrices. |

## Syntax covered by one owning comment

The following exact declaration lines contain syntax whose useful semantics are
already supplied by one owning JSDoc/comment immediately above the declaration or
the enclosing behavioral test. This is not a blanket declaration or callback
exception.

| Exact pointer(s) | Owning-comment reason |
| --- | --- |
| `lib/contracts.mjs:4,6,8,10,12,14,15,60,71,81,91,92,98,105,122,143,148,160,167,168,169,171,179,182,192,195,200,203,210,215,224,233,238,251,260,270,271,277,282,290,322,330,338,351,353,354,355,356,363,364,368,370,377,378,386,388,390,397,399,400,406` | Each exact declaration is covered by its immediately preceding or enclosing contract-validator, digest, rendering, or extraction comment. |
| `lib/issue-factory.mjs:7,15,23,30,44,46,47,50,51,57,62,64,68,70,75,83,84,86,89,92,94,98,102,106,107,109,114,115` | Exact declaration bindings are covered by their publication, authentication, or Project-readback owners. |
| `lib/validation.mjs:6,8,14,16,18,20,28,30,33,49,63,67,68,70,75,90,91,93,97,98,99,100,101,102,119,124,129,130,138,142,143,147,149,151,156,158,163,165,169,171,177,179,180,184,185,191,195,204,206,208,210,212,218,219,225,231,242,247,251,256,265,266,293,294,297,299,303` | Owning parser, schema, manifest, permission, and project-validation comments explain these declarations. |
| `lib/change-boundary.mjs:5,12,21,43,44` | Each exact binding is covered by staged-boundary evidence or immutable-boundary comments. |
| `lib/dependency-update.mjs:5,7,9,16,23,33,34,40,42,55,70,80,84,85,89,93,95,99,104,109,111,112,113,119,120,126` | Exact declaration bindings are covered by their package-manager, scoped-selector, manifest, lockfile, version-preflight, or outcome owners. |
| `lib/governance-check.mjs:6,15,23,31,38,47,48,49,50,51,53,58,74,78,88,89,90,91,92,93,99,100,101,102,112,113,120,122,125,126,127,128,129,130,131,142,145,149,150,159,164,165,171,173,174,176,178,180` | Exact declaration bindings are covered by their read-only, provenance, normalization, or queue owners. |
| `lib/project-context.mjs:14,17,24,27,31,35,38,47,49` | Each exact binding is covered by its immediately preceding canonicalization, authority, containment, validation, or path-resolution comment. |
| `lib/project-items.mjs:2,7,8,9,12,14,19,37,40` | Each exact binding is covered by its immediately preceding query, pagination-state, page-outcome, connection, or field-ID comment. |
| `lib/workflow-state.mjs:5,7,9,11,20,29,36,44,48,52,54,59,72,80,82,83,85,87,96,98,100,107,108,109,111,112,116,124,133,141,143,144,148,149,150,152,171,172,173,174,175,176,177,178,179,180,181,182,183,184,190,191,207,208,218,223,232,235,239,241,243,250,254,255,258,260,262,264,265,266,269,271,281,283,285` | Exact declaration bindings are covered by their marker, chain, provenance, inspect, publication, or postflight owners. |
| `tools/change_boundary.js:8,9,20` | Owning subprocess and required-context comments explain these declarations. |
| `tools/dependency_update.js:15,16,29` | Owning subprocess and required-context comments explain these declarations. |
| `tools/governance_check.js:15,16,30,33` | Owning read-only subprocess and required-context comments explain these declarations. |
| `tools/issue_factory.js:14,16,34,37` | Owning publication subprocess and required-context comments explain these declarations. |
| `tools/workflow_state.js:14,16,34` | Owning comment subprocess and required-context comments explain these declarations. |
| `test/change-boundary.test.mjs:8,11,14,21,23,25,26` | Owning staged-boundary test comments explain these declarations. |
| `test/cli.test.mjs:5,9,11,21,28` | Owning CLI roster/validation test comments explain these declarations. |
| `test/contracts-project.test.mjs:10,11,13,21,35,36,62,70,71,80,81,98,99,108,130,131,133,143,144,146,157,169,170,172,176,177,182,185,195,196,203,212,219,229,230,231,244` | Each exact binding is covered by its fixture, malformed-matrix, or enclosing project/contract behavioral comment. |
| `test/dependency-update.test.mjs:10,12,13,14,16,28,37,38,40,53,54,56,63,64,67,69,70,73,75,77,78,80,83,91,92,93,96,99,100,104,106,107,114,115,116,121,123,125,133,142,143,145,150,152,156,161,166,167,169,177,183,184,185,193,194,195` | Exact fixture, scoped-selector matrix, integrity-pin evidence, command, and rejection-oracle bindings are covered by their dependency behavioral owners. |
| `test/distribution.test.mjs:9,13,14,16,17,19,27,28,29,52,56,58,65,72,74,75,80,89,90,91,103,112,113,114,121,122,123,129,135,136,146,147,148,149,150,151,153,162,170,171,179,181,182,185,190,193,194,208,212,224,225,227,228,230,231,234,236,239,245,247,252,255,265,273,278,288,289,290,292,297,303,304,313,314,316,317` | Exact permission, schema, documentation, wrapper, and fixture bindings are covered by their owners. |
| `test/evaluation.test.mjs:6,8,13,17` | Owning evaluation-catalog comments explain these declarations. |
| `test/governance-check.test.mjs:7,8,9,17,18,19,20,25,40,48,49,50,52,58,64,67,70,72,79,82,89,91,98` | Exact provenance and queue fixture bindings are covered by their behavioral owners. |
| `test/issue-factory.test.mjs:7,8,9,10,18,19,20,21,25,42,51,53,72,76,77,79,87,88,91,93,99,100,102,107,120,126,128,130,131,138,139,143` | Exact approval fixture, authentication outcome, captured publication, or enqueue oracle bindings are covered by their owners. |
| `test/project-context.test.mjs:11,14,27,35,37,41,44` | Each exact fixture/oracle binding is covered by its immediately preceding bounded-discovery or source-inspection comment. |
| `test/project-items.test.mjs:8,10,13,15,23,30` | Each exact fixture, adapter, page-state, node, or field-value binding is covered by its immediately preceding pagination or field-identity comment. |
| `test/workflow-state.test.mjs:7,8,9,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,49,53,63,64,65,66,67,68,73,80,81,90,91,92,93,100,101,108,109,110,113,119,120,121,122,123,125,126,127,128,129,133,134,135,143,144,149,156,157,158,159,160,168,169,170,172,174,181,182,183,184,185,186,190` | Exact fixture, chain-state, adapter-result, ordering, publication, or race bindings are covered by their artifact-chain behavioral owners. |

No generated, vendored, minified, machine-output, or unchanged inherited-
implementation exception is used by the current diff.
