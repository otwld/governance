import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { validateDistribution } from '../lib/validation.mjs';

/** Distribution assertions resolve assets from this checkout, not process cwd. */
const root = new URL('..', import.meta.url).pathname;

/** Extracts ordered shell permission rules from an agent definition. */
function bashRules(content) {
  const lines = content.split('\n');
  const start = lines.indexOf('  bash:');
  if (start < 0) return [];
  const rules = [];
  for (const line of lines.slice(start + 1)) {
    if (/^  [^ ]/.test(line)) break;
    const match = /^    "(.*)": (allow|deny)$/.exec(line);
    if (match) rules.push({ pattern: match[1], action: match[2] });
  }
  return rules;
}

/** Resolves OpenCode's last-matching glob rule for one representative command. */
function effective(rules, command) {
  let action = 'deny';
  for (const rule of rules) {
    const expression = rule.pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*');
    if (new RegExp(`^${expression}$`).test(command)) action = rule.action;
  }
  return action;
}

/** Reads one flat custom-tool permission from agent frontmatter. */
function toolPermission(content, tool) {
  return new RegExp(`^  ${tool}: (allow|deny)$`, 'm').exec(content)?.[1];
}

/** Isolates a public tool's declared argument schema for security assertions. */
function toolArgsSource(content) {
  return /\bargs:\s*\{([\s\S]*?)\}\s*,\s*\n\s*\/\*\*/.exec(content)?.[1] ?? '';
}

/** Serves as the top-level gate that all shipped assets satisfy the distribution contract together. */
test('canonical manifest distribution validates', async () => {
  assert.deepEqual(await validateDistribution(root), []);
});

/** Pins specialist skills and requires a complete manifest-owned tool matrix. */
async function verifyWorkflowRoster() {
  const manifest = JSON.parse(await readFile(new URL('../governance.manifest.json', import.meta.url), 'utf8'));
  assert.ok(manifest.tools.includes('change_boundary'));
  assert.ok(manifest.toolAccess && typeof manifest.toolAccess === 'object', 'manifest.toolAccess');
  assert.deepEqual(Object.keys(manifest.toolAccess).sort(), manifest.tools.slice().sort());
  for (const [tool, agents] of Object.entries(manifest.toolAccess)) {
    assert.ok(Array.isArray(agents) && agents.length > 0, tool);
    for (const agent of agents) assert.ok(Object.hasOwn(manifest.agents, agent), `${tool}: ${agent}`);
  }
  assert.deepEqual(manifest.toolAccess.issue_factory, [manifest.authority.issuePublication]);
  assert.deepEqual(manifest.toolAccess.workflow_state, [manifest.authority.workflowStatePublication]);
  assert.deepEqual(manifest.toolAccess.change_boundary, [manifest.authority.gitAndGitHubDelivery]);
  assert.deepEqual(manifest.toolAccess.dependency_update, ['implementer']);
  assert.deepEqual(manifest.toolAccess.governance_check.slice().sort(), ['implementer', 'orchestrator', 'planner', 'reviewer', 'task-shaper']);
  for (const skill of ['address-review', 'document-code', 'test-change']) assert.ok(manifest.skills.includes(skill), skill);
}

test('manifest declares every tool authority and changed-code skill', verifyWorkflowRoster);

/** Checks the common deny-default, secret, external, and custom-tool boundaries. */
async function verifyCommonAgentBoundaries() {
  const manifest = JSON.parse(await readFile(new URL('../governance.manifest.json', import.meta.url), 'utf8'));
  assert.ok(manifest.toolAccess && typeof manifest.toolAccess === 'object', 'manifest.toolAccess');
  for (const [name, config] of Object.entries(manifest.agents)) {
    const content = await readFile(new URL(`../agents/${name}.md`, import.meta.url), 'utf8');
    assert.match(content, /^permission:\n  "\*": deny$/m, name);
    assert.match(content, /^  read:\n    "\*": allow\n    "\*\.env": deny\n    "\*\.env\.\*": deny\n    "\*\.env\.example": allow$/m, name);
    assert.match(content, /^  external_directory:\n    "\*": deny\n    "~\/\.local\/share\/opencode\/tool-output\/\*\*": allow\n    "\/tmp\/opencode\/\*\*": allow$/m, name);
    assert.match(content, new RegExp(`^mode: ${config.mode}$`, 'm'), name);
    for (const tool of manifest.tools) assert.equal(toolPermission(content, tool), manifest.toolAccess[tool].includes(name) ? 'allow' : 'deny', `${name}: ${tool}`);
  }
  assert.match(await readFile(new URL('../agents/brainstormer.md', import.meta.url), 'utf8'), /^  skill: allow$/m);
}

test('every agent has deny-default read and external boundaries', verifyCommonAgentBoundaries);

/** Verifies role-specific tool access without broadening publication authority. */
async function verifyRoleSurfaces() {
  const implementer = await readFile(new URL('../agents/implementer.md', import.meta.url), 'utf8');
  const implementerRules = bashRules(implementer);
  for (const command of [
    'npm run ci', 'pnpm run validate', 'yarn run verify', 'bun run ci',
    'node --test test/example.test.mjs', 'nx affected --target=test',
    'pnpm exec nx run-many --target=lint', 'yarn nx show projects', 'bunx nx graph',
    'governance validate-project .',
  ]) assert.equal(effective(implementerRules, command), 'allow', command);
  assert.match(implementer, /Load `systematic-debugging` for failures, `test-change` for changed behavior, `document-code`/);
  assert.match(implementer, /`address-review` for concrete reviewed findings/);
  assert.match(implementer, /malformed, stale, contradictory, or unsafe input/);
  assert.match(implementer, /Return changed files and behavior/);
  assert.match(implementer, /exact command outcomes/);

  const orchestrator = await readFile(new URL('../agents/orchestrator.md', import.meta.url), 'utf8');
  assert.doesNotMatch(orchestrator, /^  edit: allow$/m);
  assert.match(orchestrator, /^  workflow_state: allow$/m);
  assert.match(orchestrator, /Route issue delivery and Project recovery through `deliver-issue`; route setup through `setup-node-project`/);
  assert.match(orchestrator, /Reject malformed handoffs/);
  assert.equal(effective(bashRules(orchestrator), 'gh auth status'), 'allow');
  assert.equal(effective(bashRules(orchestrator), 'gh project item-list 7 --owner OTWLD'), 'allow');
  assert.equal(toolPermission(orchestrator, 'change_boundary'), 'allow');

  const reviewer = await readFile(new URL('../agents/reviewer.md', import.meta.url), 'utf8');
  const reviewerRules = bashRules(reviewer);
  for (const command of ['gh issue list', 'gh issue view 12', 'gh pr list', 'gh pr view 34', 'gh pr diff 34', 'gh pr checks 34', 'gh run view 56', 'gh project view 7 --owner OTWLD', 'gh project field-list 7 --owner OTWLD', 'gh project item-list 7 --owner OTWLD']) assert.equal(effective(reviewerRules, command), 'allow', command);
  assert.equal(effective(reviewerRules, 'gh issue comment 12 --body approved'), 'deny');
  assert.match(reviewer, /Load `document-code` for every added or materially changed maintained JavaScript or TypeScript surface/);
  assert.match(reviewer, /change review consumes and validates the bound verification evidence/);
  assert.match(reviewer, /Route only issue, plan, or change subjects/);
  assert.match(reviewer, /verification is not a standalone review subject/);

  const taskShaper = await readFile(new URL('../agents/task-shaper.md', import.meta.url), 'utf8');
  const taskShaperRules = bashRules(taskShaper);
  for (const command of ['gh project view 7 --owner OTWLD', 'gh project field-list 7 --owner OTWLD', 'gh project item-list 7 --owner OTWLD']) assert.equal(effective(taskShaperRules, command), 'allow', command);
  assert.equal(effective(taskShaperRules, 'gh project item-edit --id item'), 'deny');
  assert.match(taskShaper, /Use `issue_factory` only to publish that issue and its trusted-author approval comment/);
  assert.match(taskShaper, /create its Project item and assign the exact Ready status/);
  assert.match(taskShaper, /orchestrator starts from verified Ready and alone owns Active, review, Done, or Blocked transitions/i);

  const researcher = await readFile(new URL('../agents/researcher.md', import.meta.url), 'utf8');
  assert.match(researcher, /Search in this order: repository evidence and configured documents/);
  assert.match(researcher, /publication or retrieval dates when freshness matters/);
  assert.match(researcher, /never silently reconcile conflicting authorities/);
  assert.match(researcher, /Return a concise answer, source table, conflicts, confidence, and remaining questions/);

  for (const [name, skill] of [['brainstormer', 'brainstorm-issue'], ['planner', 'plan-change'], ['task-shaper', 'shape-issue']]) {
    const content = await readFile(new URL(`../agents/${name}.md`, import.meta.url), 'utf8');
    assert.ok(content.includes(`Load \`${skill}\``), name);
    assert.match(content, /durable|artifact/, name);
  }
}

test('agents expose only the enriched role-specific workflow surfaces', verifyRoleSurfaces);

/** Exercises last-match shell safety, including bounded existing-branch switching. */
async function verifyShellSafety() {
  const shellAgents = ['task-shaper', 'orchestrator', 'planner', 'implementer', 'reviewer'];
  for (const name of shellAgents) {
    const rules = bashRules(await readFile(new URL(`../agents/${name}.md`, import.meta.url), 'utf8'));
    for (const command of ['git status; git push origin HEAD', 'git status && git push origin HEAD', 'git status || git push origin HEAD', 'git diff | tee patch', 'git diff > patch', 'git show < input', 'git status $(id)', 'git status `id`', 'git status ${HOME}']) assert.equal(effective(rules, command), 'deny', `${name}: ${command}`);
    for (const command of ['git diff --output=file', 'git show --output=file', 'git log --output=file']) assert.equal(effective(rules, command), 'deny', `${name}: ${command}`);
    for (const command of ['git reset --hard', 'git push --force origin HEAD', 'gh pr merge 1 --admin', 'npm publish', 'pnpm run deploy', 'yarn publish', 'bun run deploy']) assert.equal(effective(rules, command), 'deny', `${name}: ${command}`);
  }
  const orchestrator = bashRules(await readFile(new URL('../agents/orchestrator.md', import.meta.url), 'utf8'));
  assert.equal(effective(orchestrator, 'git push origin HEAD'), 'allow');
  assert.equal(effective(orchestrator, 'gh pr merge --squash 12'), 'allow');
  assert.equal(effective(orchestrator, 'gh pr merge --squash 12 -d'), 'deny');
  assert.equal(effective(orchestrator, 'git switch -c branch --discard-changes'), 'deny');
  assert.equal(effective(orchestrator, 'git switch existing-branch'), 'allow');
  assert.equal(effective(orchestrator, 'git switch -c new-branch'), 'allow');
  assert.equal(effective(orchestrator, 'git worktree list --porcelain'), 'allow');
  assert.equal(effective(orchestrator, 'git write-tree'), 'deny');
  for (const command of ['git switch --detach abc', 'git switch -d abc', 'git switch --force abc', 'git switch -f abc', 'git switch -C abc', 'git switch existing --discard-changes', 'git switch existing --quiet', 'git switch existing -q']) assert.equal(effective(orchestrator, command), 'deny', command);
  assert.equal(effective(orchestrator, 'gh project field-list 2 --owner OTWLD'), 'allow');
}

test('last-match shell denies block compound input and dangerous actions', verifyShellSafety);

/** Prevents non-orchestrator roles from acquiring branch, Project, or pull-request mutation authority. */
test('only orchestrator carries delivery mutation allows', async () => {
  for (const name of ['brainstormer', 'task-shaper', 'planner', 'implementer', 'reviewer', 'researcher']) {
    const content = await readFile(new URL(`../agents/${name}.md`, import.meta.url), 'utf8');
    assert.doesNotMatch(content, /^    "git (?:add|commit|push origin|switch -c).*": allow$/m, name);
    assert.doesNotMatch(content, /^    "gh (?:project item-edit|pr (?:create|edit|merge)).*": allow$/m, name);
  }
});

/** Checks thin command routing and the setup/review blocker boundaries. */
async function verifyCommandRouting() {
  const manifest = JSON.parse(await readFile(new URL('../governance.manifest.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(manifest.commands).sort(), ['brainstorm', 'issue', 'review', 'run-issue', 'run-project', 'setup-project']);
  for (const name of ['brainstorm', 'issue', 'run-issue', 'run-project']) {
    const content = await readFile(new URL(`../commands/${name}.md`, import.meta.url), 'utf8');
    assert.ok(content.split('\n').length <= 8, `${name} must remain thin`);
  }
  const review = await readFile(new URL('../commands/review.md', import.meta.url), 'utf8');
  assert.match(review, /issues to `review-issue`, plans to `review-plan`, and changes to `review-change`/);
  assert.match(review, /verification is not a standalone review subject/);
  assert.doesNotMatch(review, /issue, plan, change, or verification subject/);
  assert.match(review, /return `BLOCKED` without guessing/);
  const setup = await readFile(new URL('../commands/setup-project.md', import.meta.url), 'utf8');
  assert.match(setup, /evidence-only inspection/);
  assert.match(setup, /delegate the smallest required file edits and checks to the implementer/);
  const orchestrator = await readFile(new URL('../agents/orchestrator.md', import.meta.url), 'utf8');
  const implementer = await readFile(new URL('../agents/implementer.md', import.meta.url), 'utf8');
  assert.equal(toolPermission(orchestrator, 'governance_check'), 'allow');
  assert.equal(toolPermission(implementer, 'governance_check'), 'allow');
  assert.equal(toolPermission(implementer, 'dependency_update'), 'allow');
  assert.equal(toolPermission(orchestrator, 'change_boundary'), 'allow');
  assert.equal(toolPermission(implementer, 'change_boundary'), 'deny');
  assert.match(implementer, /^  edit: allow$/m);
}

test('commands preserve the canonical roster and route to detailed skills', verifyCommandRouting);

/** Verifies shipped templates and policy documentation at stable semantic anchors. */
async function verifyTemplatesAndDocumentation() {
  await assert.rejects(readFile(new URL('../templates/.github/ISSUE_TEMPLATE/agent-task.yml', import.meta.url), 'utf8'), { code: 'ENOENT' });
  const minimal = JSON.parse(await readFile(new URL('../templates/project.json', import.meta.url), 'utf8'));
  assert.equal(minimal.githubProject, undefined);
  assert.match(minimal.repository, /<owner>/);
  assert.deepEqual(minimal.trustedActors, ['<GitHub login allowed to publish governance artifacts>']);
  const project = JSON.parse(await readFile(new URL('../templates/project.github.example.json', import.meta.url), 'utf8'));
  assert.equal(project.githubProject.number, '<verified Project number>');
  assert.equal(project.githubProject.priorityFieldId, '<verified Priority field ID>');
  assert.deepEqual(project.githubProject.priorityOptions, [
    { name: '<highest priority name>', optionId: '<highest priority option ID>' },
    { name: '<next priority name>', optionId: '<next priority option ID>' },
  ]);
  assert.equal(project.githubProject.priorityOptionIds, undefined);
  assert.equal(project.githubProject.missingPriority, 'last');
  assert.equal(project.githubProject.includeDrafts, false);
  assert.equal(project.githubProject.includeArchived, false);
  assert.deepEqual(project.trustedActors, ['<GitHub login allowed to publish governance artifacts>']);
  const opencode = JSON.parse(await readFile(new URL('../templates/opencode.json', import.meta.url), 'utf8'));
  const manifest = JSON.parse(await readFile(new URL('../governance.manifest.json', import.meta.url), 'utf8'));
  /** Tool roster after the pending change-boundary manifest integration. */
  const expectedTools = [...new Set([...manifest.tools, 'change_boundary'])].sort();
  for (const tool of expectedTools) assert.equal(opencode.permission[tool], 'deny', tool);
  assert.deepEqual(Object.keys(opencode.permission).sort(), expectedTools);
  const pullRequest = await readFile(new URL('../templates/.github/pull_request_template.md', import.meta.url), 'utf8');
  for (const marker of ['Issue digest', 'Approval comment URL/author', 'Approval artifact digest/marker', 'Plan digest', 'planReviewDigest', 'Change digest', 'changeReviewDigest', 'Pull request head SHA', 'Verification digest/status', 'Dependency manager/version preflight', 'Required CI and result', 'correction count', 'Documentation evidence', 'Project status', 'Current-head preflight', 'Invalidated evidence', 'Rollback procedure']) assert.match(pullRequest, new RegExp(marker, 'i'), marker);
  assert.match(pullRequest, /Issue documentation \(`declarations`, `external`, `rationale`\)/);
  assert.match(pullRequest, /Plan documentation \(`actions`, `external`, `rationale`\)/);
  const guidance = await readFile(new URL('../AGENTS.md', import.meta.url), 'utf8');
  /** Whitespace-normalized policy used only for exact semantic phrase checks. */
  const normalizedGuidance = guidance.replace(/\s+/g, ' ');
  assert.match(guidance, /EVERY added or materially changed declaration, variable, callback, and test callback/);
  assert.match(guidance, /Record each\s+exception with a file\/line pointer and short reason/i);
  for (const exception of ['generated/vendored/minified/machine', 'imports/reexports', 'parameters covered by their owner', 'destructuring aliases', 'loop/catch bindings', 'unchanged inherited implementation', 'syntax covered by one owning comment']) assert.match(normalizedGuidance, new RegExp(exception), exception);
  assert.doesNotMatch(guidance, /trivial structural callbacks|framework-mandated boilerplate|canonical overload/);
  assert.match(guidance, /Untouched historical code does\s+not block/);
  assert.match(normalizedGuidance, /Keep external documentation current/);
  assert.match(normalizedGuidance, /adapted upstream material must identify its source and use a compatible license/);
  assert.match(guidance, /skills\/document-code\/references\/policy\.md/);
  const guidanceTemplate = await readFile(new URL('../templates/AGENTS.md', import.meta.url), 'utf8');
  /** Whitespace-normalized installed policy used for exact exception checks. */
  const normalizedGuidanceTemplate = guidanceTemplate.replace(/\s+/g, ' ');
  assert.match(guidanceTemplate, /EVERY added or materially changed declaration, variable, callback, and test callback/);
  assert.match(guidanceTemplate, /Record each exception with a file\/line pointer and short reason/);
  assert.doesNotMatch(guidanceTemplate, /trivial structural callbacks|framework boilerplate|canonical overload/);
  assert.match(guidanceTemplate, /Untouched historical\s+code does not block/);
  for (const exception of ['generated/vendored/minified/machine', 'imports/reexports', 'parameters covered by their owner', 'destructuring aliases', 'loop/catch bindings', 'unchanged inherited implementation', 'syntax covered by one owning comment']) assert.match(normalizedGuidanceTemplate, new RegExp(exception), exception);
  assert.match(guidanceTemplate, /npm must resolve from `PATH` at that version/);
  assert.match(guidanceTemplate, /pnpm and Yarn Berry use Corepack at the pinned version/);
  const contracts = await readFile(new URL('../docs/contracts.md', import.meta.url), 'utf8');
  assert.match(contracts, /required `documentation` field.*changed-code declarations, external semantic documents, and an impact rationale/);
  assert.match(contracts, /required `documentation` field.*concrete actions with rationale/);
  assert.match(contracts, /`governance_check` performs read-only contract, binding, provenance, and queue checks/);
  assert.match(contracts, /`workflow_state` inspect action reads durable comments without publishing/);
  assert.match(contracts, /approved issue contract and matching issue review.*machine-recognizable issue comment/);
  assert.match(contracts, /Public wrappers require the supplied OpenCode `context\.directory`/);
  assert.match(contracts, /paginated GraphQL/);
  assert.match(contracts, /always excludes draft and archived items/);
  assert.match(contracts, /`planReviewDigest` and\s+`changeReviewDigest` are separate fields/);
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /Task-shaper alone publishes approved issues, creates the intake Project item, and assigns Ready/);
  assert.match(readme, /Orchestrator starts from verified Ready and alone owns Active, review, Done, and Blocked transitions/);
  assert.match(readme, /Deterministic evaluation tests validate fixture structure only/);
  assert.match(readme, /Manual configured-model\s+results are separate evidence/);
  assert.match(readme, /npm must resolve from `PATH` at the exact pinned version/);
  assert.match(readme, /pnpm and Yarn Berry run through Corepack at their exact pins/);
  assert.match(readme, /never use process cwd as authority/);
  const operations = await readFile(new URL('../docs/operations.md', import.meta.url), 'utf8');
  assert.match(operations, /task-shaper only item-add, the item-edit needed to assign the configured Ready\s+option, and Project readback/);
  assert.match(operations, /orchestrator.*Project item-edit\/readback for\s+post-Ready Active, review, Done, and Blocked transitions/s);
  assert.match(operations, /npm.*resolves npm from `PATH` and requires its\s+exact version to match the pin/s);
  assert.match(operations, /pnpm and Yarn Berry, execution uses Corepack/);
  const skillAuthoring = await readFile(new URL('../docs/skill-authoring.md', import.meta.url), 'utf8');
  assert.match(skillAuthoring, /agentskills\.io\/specification/);
  assert.match(skillAuthoring, /Every distributed skill declares `license: MIT`/);
}

test('templates and docs expose durable evidence without fake Project defaults', verifyTemplatesAndDocumentation);

/** Verifies public wrappers cannot accept caller-selected trust context. */
async function verifyPublicToolSchemas() {
  /** Public wrapper source keyed by manifest tool name. */
  const sources = {};
  for (const tool of ['issue_factory', 'workflow_state', 'governance_check', 'dependency_update', 'change_boundary']) sources[tool] = await readFile(new URL(`../tools/${tool}.js`, import.meta.url), 'utf8');
  for (const tool of ['issue_factory', 'workflow_state', 'governance_check', 'change_boundary']) {
    /** Caller-visible schema fragment inspected for forbidden trust overrides. */
    const args = toolArgsSource(sources[tool]);
    assert.notEqual(args, '', tool);
    assert.doesNotMatch(args, /\brepository:|\btrustedActors:|\bproject:/, tool);
    assert.match(sources[tool], /loadProjectContext/, tool);
  }
  for (const [tool, source] of Object.entries(sources)) {
    assert.doesNotMatch(source, /process\.cwd\(\)/, tool);
    assert.match(source, /loadProjectContext\(context\?\.directory\)/, tool);
    assert.doesNotMatch(source, /context\?\.directory\s*\?\?|context\?\.directory\s*\|\|/, tool);
  }
  /** Workflow inputs that inspection does not require. */
  const workflowArgs = toolArgsSource(sources.workflow_state);
  for (const argument of ['artifactKind', 'artifact', 'digest', 'priorDigest']) assert.match(workflowArgs, new RegExp(`${argument}: .*\\.optional\\(\\)`), argument);
  assert.match(sources.governance_check, /description: 'Read-only/);
  assert.match(sources.change_boundary, /export default tool\(/);
}

test('public tool schemas derive trust context and keep inspect inputs optional', verifyPublicToolSchemas);

/** Proves the validator detects a missing required review field rather than trusting schema syntax alone. */
test('distribution validation rejects malformed contract schema shape', async (t) => {
  const fixture = await mkdtemp(join(tmpdir(), 'governance-distribution-')); t.after(() => rm(fixture, { recursive: true, force: true }));
  for (const path of ['agents', 'commands', 'skills', 'tools', 'lib', 'schemas', 'templates']) await cp(join(root, path), join(fixture, path), { recursive: true });
  await cp(join(root, 'governance.manifest.json'), join(fixture, 'governance.manifest.json'));
  const schemaPath = join(fixture, 'schemas/review.schema.json');
  const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
  delete schema.properties.subject;
  await writeFile(schemaPath, JSON.stringify(schema));
  assert.match((await validateDistribution(fixture)).map((item) => item.message).join('\n'), /missing required top-level contract field subject/);
});
