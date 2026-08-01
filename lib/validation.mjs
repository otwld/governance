import { readFile, realpath, readdir, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { validateContract } from './contracts.mjs';

const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const diagnostic = (path, message) => ({ path, message });
export const formatDiagnostic = ({ path, message }) => `${path}: ${message}`;

function frontmatter(content) {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== '---') return { data: {}, lines: [], error: 'missing opening frontmatter delimiter' };
  const end = lines.indexOf('---', 1);
  if (end < 0) return { data: {}, lines: [], error: 'missing closing frontmatter delimiter' };
  const data = {};
  for (const line of lines.slice(1, end)) {
    const match = /^([A-Za-z][\w-]*):\s*(.*?)\s*$/.exec(line);
    if (match) data[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return { data, lines: lines.slice(1, end) };
}

function permission(lines, tool = '*') {
  const start = lines.findIndex((line) => line === 'permission:');
  if (start < 0) return undefined;
  const escaped = tool.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const line of lines.slice(start + 1)) {
    if (/^[^\s]/.test(line)) break;
    const match = new RegExp(`^  (?:"${escaped}"|'${escaped}'|${escaped}): (allow|deny)$`).exec(line);
    if (match) return match[1];
  }
}

async function names(root, directory, extension = '.md') {
  try {
    return (await readdir(join(root, directory), { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
      .map((entry) => entry.name.slice(0, -extension.length)).sort();
  } catch { return []; }
}

function compareRoster(path, actual, expected) {
  const errors = [];
  for (const name of expected) if (!actual.includes(name)) errors.push(diagnostic(path, `missing required ${name}`));
  for (const name of actual) if (!expected.includes(name)) errors.push(diagnostic(`${path}/${name}`, 'not declared by governance.manifest.json'));
  return errors;
}

async function json(root, path, diagnostics) {
  try { return JSON.parse(await readFile(join(root, path), 'utf8')); }
  catch (error) { diagnostics.push(diagnostic(path, error.code === 'ENOENT' ? 'file does not exist' : `cannot parse JSON: ${error.message}`)); return undefined; }
}

function validateSchemaShape(name, schema, diagnostics) {
  const path = `schemas/${name}.schema.json`;
  if (!record(schema)) return;
  if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') diagnostics.push(diagnostic(path, 'must declare the supported JSON Schema dialect'));
  if (schema.type !== 'object' || schema.additionalProperties !== false || !Array.isArray(schema.required) || !record(schema.properties)) diagnostics.push(diagnostic(path, 'must define a closed top-level object with required and properties'));
  const disallowed = ['ver', 'sion'].join('');
  const stack = [schema];
  while (stack.length) {
    const value = stack.pop();
    if (!record(value)) continue;
    if (record(value.properties) && Object.hasOwn(value.properties, disallowed)) diagnostics.push(diagnostic(path, 'contains a disallowed historical contract marker'));
    for (const child of Object.values(value)) if (record(child)) stack.push(child); else if (Array.isArray(child)) stack.push(...child);
  }
  const expected = {
    project: ['repository', 'commands', 'documents', 'merge'],
    issue: ['repository', 'title', 'outcome', 'problemEvidence', 'requirements', 'scope', 'technicalDirection', 'acceptanceScenarios', 'validation', 'dependencies', 'assumptions', 'references'],
    plan: ['issueDigest', 'summary', 'steps', 'validation', 'risks', 'compatibility', 'rollback'],
    review: ['subjectKind', 'subjectDigest', 'verdict', 'findings'],
    verification: ['subjectDigest', 'changeDigest', 'status', 'commands'],
  }[name];
  for (const key of expected) if (!schema.required?.includes(key) || !Object.hasOwn(schema.properties ?? {}, key)) diagnostics.push(diagnostic(path, `missing required top-level contract field ${key}`));
}

export async function validateDistribution(root = process.cwd()) {
  root = resolve(root);
  const diagnostics = [];
  const manifest = await json(root, 'governance.manifest.json', diagnostics);
  if (!record(manifest)) return diagnostics;
  const allowedManifest = ['agents', 'commands', 'skills', 'tools', 'authority', 'assets'];
  for (const key of Object.keys(manifest)) if (!allowedManifest.includes(key)) diagnostics.push(diagnostic(`governance.manifest.json.${key}`, 'unknown property'));
  for (const key of allowedManifest) if (!(key in manifest)) diagnostics.push(diagnostic(`governance.manifest.json.${key}`, 'required property'));
  if (!record(manifest.agents) || !record(manifest.commands) || !record(manifest.authority) || !Array.isArray(manifest.skills) || !Array.isArray(manifest.tools) || !Array.isArray(manifest.assets)) return diagnostics;
  const agentRoster = Object.keys(manifest.agents ?? {}).sort();
  const commandRoster = Object.keys(manifest.commands ?? {}).sort();
  const skillRoster = [...(manifest.skills ?? [])].sort();
  const toolRoster = [...(manifest.tools ?? [])].sort();
  const defaults = Object.entries(manifest.agents).filter(([, value]) => record(value) && value.default);
  if (defaults.length !== 1 || defaults[0]?.[1].mode !== 'primary') diagnostics.push(diagnostic('governance.manifest.json.agents', 'must declare exactly one primary default agent'));
  for (const [name, value] of Object.entries(manifest.agents)) if (!record(value) || !['primary', 'subagent'].includes(value.mode)) diagnostics.push(diagnostic(`governance.manifest.json.agents.${name}`, 'must declare a primary or subagent mode'));
  for (const [name, agent] of Object.entries(manifest.commands)) if (!agentRoster.includes(agent)) diagnostics.push(diagnostic(`governance.manifest.json.commands.${name}`, `references missing agent ${agent}`));
  if (!agentRoster.includes(manifest.authority.issuePublication) || !agentRoster.includes(manifest.authority.gitAndGitHubDelivery) || manifest.authority.issuePublication === manifest.authority.gitAndGitHubDelivery) diagnostics.push(diagnostic('governance.manifest.json.authority', 'must name distinct declared publication and delivery agents'));
  const expectedAssets = ['agents', 'commands', 'skills', 'tools', 'lib'];
  if (manifest.assets.length !== expectedAssets.length || expectedAssets.some((name) => !manifest.assets.includes(name))) diagnostics.push(diagnostic('governance.manifest.json.assets', `must contain exactly ${expectedAssets.join(', ')}`));
  diagnostics.push(...compareRoster('agents', await names(root, 'agents'), agentRoster));
  diagnostics.push(...compareRoster('commands', await names(root, 'commands'), commandRoster));
  diagnostics.push(...compareRoster('tools', await names(root, 'tools', '.js'), toolRoster));
  let actualSkills = [];
  try { actualSkills = (await readdir(join(root, 'skills'), { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort(); } catch {}
  diagnostics.push(...compareRoster('skills', actualSkills, skillRoster));

  for (const name of agentRoster) {
    const path = `agents/${name}.md`;
    let parsed;
    try { parsed = frontmatter(await readFile(join(root, path), 'utf8')); } catch { continue; }
    if (parsed.error) diagnostics.push(diagnostic(path, parsed.error));
    if (!parsed.data.description) diagnostics.push(diagnostic(path, 'description is required'));
    if (parsed.data.mode !== manifest.agents[name]?.mode) diagnostics.push(diagnostic(path, `mode must be ${manifest.agents[name]?.mode}`));
    if (permission(parsed.lines) !== 'deny') diagnostics.push(diagnostic(path, 'all agents must deny by default'));
    if (/\bask\b/.test(parsed.lines.join('\n'))) diagnostics.push(diagnostic(path, 'permission actions must not ask'));
    const publication = permission(parsed.lines, 'issue_factory');
    const expected = name === manifest.authority?.issuePublication ? 'allow' : 'deny';
    if (publication !== expected) diagnostics.push(diagnostic(path, `issue_factory must be ${expected}`));
    if (manifest.agents[name]?.readOnly && /^  edit: allow$/m.test(parsed.lines.join('\n'))) diagnostics.push(diagnostic(path, 'read-only agent cannot edit'));
    const permissionText = parsed.lines.join('\n');
    const readOrder = ['    "*": allow', '    "*.env": deny', '    "*.env.*": deny', '    "*.env.example": allow'].map((line) => permissionText.indexOf(line));
    if (readOrder.some((index) => index < 0) || readOrder.some((index, position) => position > 0 && index <= readOrder[position - 1])) diagnostics.push(diagnostic(path, 'read permission must allow generally, deny env files, then allow the example file'));
    if (!/^  external_directory:\n    "\*": deny/m.test(permissionText)) diagnostics.push(diagnostic(path, 'external_directory must deny by default'));
    if (name === 'brainstormer' && permission(parsed.lines, 'skill') !== 'allow') diagnostics.push(diagnostic(path, 'brainstormer must allow skill access'));
    const deliveryMutation = /^    "(?:git (?:switch -c|add|commit|push)|gh (?:project item-edit|pr (?:create|edit|merge))).*": allow$/m.test(parsed.lines.join('\n'));
    if (name !== manifest.authority?.gitAndGitHubDelivery && deliveryMutation) diagnostics.push(diagnostic(path, 'only the delivery authority may allow Git or GitHub delivery mutations'));
    const bashStart = parsed.lines.indexOf('  bash:');
    if (bashStart >= 0) {
      const bashLines = [];
      for (const line of parsed.lines.slice(bashStart + 1)) {
        if (/^  [^ ]/.test(line)) break;
        if (line.startsWith('    ')) bashLines.push(line);
      }
      const lastAllow = bashLines.reduce((last, line, index) => line.endsWith(': allow') ? index : last, -1);
      for (const pattern of ['*;*', '*&*', '*||*', '*|*', '*>*', '*<*', '*$(*', '*`*', '*${*']) {
        const index = bashLines.indexOf(`    "${pattern}": deny`);
        if (index <= lastAllow) diagnostics.push(diagnostic(path, `bash safety deny ${pattern} must appear after every allow`));
      }
    }
  }
  const deliveryPath = `agents/${manifest.authority?.gitAndGitHubDelivery}.md`;
  try {
    const delivery = await readFile(join(root, deliveryPath), 'utf8');
    for (const required of ['"git commit -m *": allow', '"git push origin HEAD": allow', '"gh pr create*": allow', '"gh pr merge --squash*": allow']) if (!delivery.includes(required)) diagnostics.push(diagnostic(deliveryPath, `delivery authority missing ${required}`));
  } catch {}
  for (const name of commandRoster) {
    const path = `commands/${name}.md`;
    try {
      const parsed = frontmatter(await readFile(join(root, path), 'utf8'));
      if (parsed.data.agent !== manifest.commands[name]) diagnostics.push(diagnostic(path, `agent must be ${manifest.commands[name]}`));
      if (!parsed.data.description) diagnostics.push(diagnostic(path, 'description is required'));
    } catch {}
  }
  for (const name of skillRoster) {
    const path = `skills/${name}/SKILL.md`;
    try {
      const content = await readFile(join(root, path), 'utf8');
      const parsed = frontmatter(content);
      if (parsed.data.name !== name) diagnostics.push(diagnostic(path, `name must be ${name}`));
      if (!parsed.data.description || parsed.data.license !== 'MIT') diagnostics.push(diagnostic(path, 'description and MIT license are required'));
      for (const match of content.matchAll(/\]\((?!https?:|#)([^)]+)\)/g)) {
        const target = resolve(join(root, 'skills', name), match[1]);
        const skillRoot = resolve(join(root, 'skills', name));
        if (target !== skillRoot && !target.startsWith(`${skillRoot}${sep}`)) diagnostics.push(diagnostic(path, `reference escapes skill folder: ${match[1]}`));
        else try { await stat(target); } catch { diagnostics.push(diagnostic(path, `missing reference: ${match[1]}`)); }
      }
    } catch { diagnostics.push(diagnostic(path, 'file does not exist')); }
  }
  const template = await json(root, 'templates/opencode.json', diagnostics);
  if (template?.default_agent !== Object.entries(manifest.agents).find(([, value]) => value.default)?.[0]) diagnostics.push(diagnostic('templates/opencode.json.default_agent', 'must match manifest default agent'));
  if (template?.permission?.issue_factory !== 'deny') diagnostics.push(diagnostic('templates/opencode.json.permission.issue_factory', 'must deny issue_factory globally'));
  for (const schemaName of ['project', 'issue', 'plan', 'review', 'verification']) {
    const schema = await json(root, `schemas/${schemaName}.schema.json`, diagnostics);
    validateSchemaShape(schemaName, schema, diagnostics);
  }
  return diagnostics;
}

function unknown(value, allowed, path, diagnostics) { for (const key of Object.keys(value)) if (!allowed.includes(key)) diagnostics.push(diagnostic(`${path}.${key}`, 'unknown property')); }
const nonempty = (value) => typeof value === 'string' && value.trim() !== '';
const SAFE_TOKEN = '[A-Za-z0-9_@%+=:,./*?\\[\\]-]+';
const SAFE_ARGS = `(?: ${SAFE_TOKEN})*`;
const SAFE_SCRIPT = '(?:test|lint|typecheck|check|validate|build|ci|verify)(?::[A-Za-z0-9_@%+=:,./*?\\[\\]-]+)*';
const NO_MUTATING_FLAGS = '(?!.*(?:^| )(?:--fix|--write|--update(?:-?snapshots?|Snapshots?)?|--watch(?:All|-all)?|-u|-w)(?:=| |$))';
export const VERIFY_COMMAND_PATTERN_SOURCE = `^(?!.*[\\r\\n])${NO_MUTATING_FLAGS}(?:npm (?:test|run ${SAFE_SCRIPT})|pnpm (?:test|run ${SAFE_SCRIPT})|yarn (?:run )?${SAFE_SCRIPT}|bun (?:test|run ${SAFE_SCRIPT})|node --(?:test|check)|(?:nx|npx nx|pnpm (?:nx|exec nx)|yarn nx|bunx nx) (?:affected|run-many|test|lint|build))${SAFE_ARGS}$`;
export const INSTALL_COMMAND_PATTERN_SOURCE = `^(?!.*[\\r\\n])(?:npm ci|pnpm install --frozen-lockfile|yarn install --immutable|bun install --frozen-lockfile)${SAFE_ARGS}$`;
const verifyCommand = new RegExp(VERIFY_COMMAND_PATTERN_SOURCE);
const installCommand = new RegExp(INSTALL_COMMAND_PATTERN_SOURCE);
function safePath(value) { return nonempty(value) && !isAbsolute(value) && !value.includes('\\') && !value.split('/').some((part) => ['', '.', '..'].includes(part)); }

export function validateProjectConfig(config, { source = '.opencode/project.json' } = {}) {
  const diagnostics = [];
  if (!record(config)) return [diagnostic(source, 'configuration must be an object')];
  unknown(config, ['$schema', 'repository', 'commands', 'documents', 'githubProject', 'merge'], source, diagnostics);
  if (config.$schema !== undefined && !nonempty(config.$schema)) diagnostics.push(diagnostic(`${source}.$schema`, 'must be non-empty'));
  if (!/^[^/\s]+\/[^/\s]+$/.test(config.repository ?? '')) diagnostics.push(diagnostic(`${source}.repository`, 'must be owner/name'));
  if (!record(config.commands)) diagnostics.push(diagnostic(`${source}.commands`, 'must be an object'));
  else {
    unknown(config.commands, ['verify', 'install'], `${source}.commands`, diagnostics);
    if (!nonempty(config.commands.verify) || !verifyCommand.test(config.commands.verify)) diagnostics.push(diagnostic(`${source}.commands.verify`, 'must be a supported non-mutating verification command using safe tokens'));
    if (config.commands.install !== undefined && (!nonempty(config.commands.install) || !installCommand.test(config.commands.install))) diagnostics.push(diagnostic(`${source}.commands.install`, 'must be a supported lockfile install command'));
  }
  if (!Array.isArray(config.documents) || config.documents.length === 0) diagnostics.push(diagnostic(`${source}.documents`, 'must be non-empty'));
  else for (const [index, item] of config.documents.entries()) {
    const path = `${source}.documents[${index}]`;
    if (!record(item)) diagnostics.push(diagnostic(path, 'must be an object'));
    else { unknown(item, ['path', 'purpose'], path, diagnostics); if (!safePath(item.path)) diagnostics.push(diagnostic(`${path}.path`, 'must be a safe relative path')); if (!nonempty(item.purpose)) diagnostics.push(diagnostic(`${path}.purpose`, 'must be non-empty')); if (config.documents.slice(0, index).some((previous) => record(previous) && previous.path === item.path && previous.purpose === item.purpose)) diagnostics.push(diagnostic(path, 'duplicates a document entry')); }
  }
  if (config.githubProject !== undefined) {
    const project = config.githubProject;
    if (!record(project)) diagnostics.push(diagnostic(`${source}.githubProject`, 'must be an object'));
    else {
      unknown(project, ['owner', 'number', 'id', 'statusFieldId', 'statusOptionIds', 'statuses', 'priorityField'], `${source}.githubProject`, diagnostics);
      if (!nonempty(project.owner)) diagnostics.push(diagnostic(`${source}.githubProject.owner`, 'must be non-empty'));
      if (!Number.isInteger(project.number) || project.number < 1) diagnostics.push(diagnostic(`${source}.githubProject.number`, 'must be a positive integer'));
      for (const key of ['id', 'statusFieldId']) if (!nonempty(project[key])) diagnostics.push(diagnostic(`${source}.githubProject.${key}`, 'must be non-empty'));
      const keys = ['ready', 'active', 'review', 'done', 'blocked'];
      if (!record(project.statuses)) diagnostics.push(diagnostic(`${source}.githubProject.statuses`, 'must be an object'));
      else { unknown(project.statuses, keys, `${source}.githubProject.statuses`, diagnostics); for (const key of keys) if (!nonempty(project.statuses[key])) diagnostics.push(diagnostic(`${source}.githubProject.statuses.${key}`, 'must be non-empty')); const values = keys.map((key) => project.statuses[key]); if (values.filter(nonempty).length !== new Set(values.filter(nonempty)).size) diagnostics.push(diagnostic(`${source}.githubProject.statuses`, 'values must be distinct')); }
      if (!record(project.statusOptionIds)) diagnostics.push(diagnostic(`${source}.githubProject.statusOptionIds`, 'must be an object'));
      else { unknown(project.statusOptionIds, keys, `${source}.githubProject.statusOptionIds`, diagnostics); for (const key of keys) if (!nonempty(project.statusOptionIds[key])) diagnostics.push(diagnostic(`${source}.githubProject.statusOptionIds.${key}`, 'must be non-empty')); const optionIds = keys.map((key) => project.statusOptionIds[key]).filter(nonempty); if (optionIds.length !== new Set(optionIds).size) diagnostics.push(diagnostic(`${source}.githubProject.statusOptionIds`, 'values must be distinct')); }
      if (project.priorityField !== undefined && !nonempty(project.priorityField)) diagnostics.push(diagnostic(`${source}.githubProject.priorityField`, 'must be non-empty'));
    }
  }
  if (!record(config.merge) || config.merge.method !== 'squash' || typeof config.merge.automatic !== 'boolean') diagnostics.push(diagnostic(`${source}.merge`, 'must specify squash method and boolean automatic'));
  else unknown(config.merge, ['method', 'automatic'], `${source}.merge`, diagnostics);
  return diagnostics;
}

export async function validateProject(root = process.cwd(), { checkDocuments = true } = {}) {
  root = resolve(root);
  const source = '.opencode/project.json';
  let config;
  try { config = JSON.parse(await readFile(join(root, source), 'utf8')); }
  catch (error) { return [diagnostic(source, error.code === 'ENOENT' ? 'file does not exist' : `cannot parse JSON: ${error.message}`)]; }
  const diagnostics = validateProjectConfig(config, { source });
  if (checkDocuments && Array.isArray(config.documents)) {
    let realRoot;
    try { realRoot = await realpath(root); } catch { realRoot = root; }
    for (const [index, item] of config.documents.entries()) if (record(item) && safePath(item.path)) {
      try {
        const target = await realpath(join(root, item.path));
        if (target !== realRoot && !target.startsWith(`${realRoot}${sep}`)) diagnostics.push(diagnostic(`${source}.documents[${index}].path`, `referenced document escapes repository: ${item.path}`));
      } catch { diagnostics.push(diagnostic(`${source}.documents[${index}].path`, `referenced document does not exist: ${item.path}`)); }
    }
  }
  return diagnostics;
}

export { validateContract };
