import { readFile, readdir, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const AGENT_FIELDS = ['description', 'mode'];
const COMMAND_FIELDS = ['description', 'agent'];
const SKILL_FIELDS = ['name', 'description'];
const AGENT_MODES = new Set(['primary', 'subagent', 'all']);
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PRODUCTION_AGENTS = ['orchestrator', 'implementer', 'reviewer', 'researcher'];
const PRODUCTION_COMMANDS = ['orchestrate', 'orchestrate-loop', 'setup-project', 'review'];
const PRODUCTION_AGENT_MODES = new Map([
  ['orchestrator', 'primary'],
  ['implementer', 'subagent'],
  ['reviewer', 'subagent'],
  ['researcher', 'subagent'],
]);
const PRODUCTION_COMMAND_AGENTS = new Map([
  ['orchestrate', 'orchestrator'],
  ['orchestrate-loop', 'orchestrator'],
  ['setup-project', 'orchestrator'],
  ['review', 'reviewer'],
]);
const PRODUCTION_SKILLS = [
  'dependency-upgrade',
  'nx-impact-analysis',
  'setup-node-project',
  'verify-change',
];
const SAFE_COMMAND_TOKEN = '[A-Za-z0-9_@%+=:,./*?-]+';
const SAFE_SCRIPT_SUFFIX = '[A-Za-z0-9_@%+=,./*?-]+';
const SAFE_SCRIPT = `(?:test|lint|typecheck|check|validate|build|ci|verify)(?::${SAFE_SCRIPT_SUFFIX})*`;
const SAFE_NX_RUNNER = '(?:nx|npx[ \\t]+nx|pnpm[ \\t]+(?:nx|exec[ \\t]+nx)|yarn[ \\t]+nx|bunx[ \\t]+nx)';
const SAFE_NX_COMMAND = '(?:affected|run-many|test|lint|build)';
const VERIFY_COMMAND_PATTERN = new RegExp(
  `^(?:` +
    `npm[ \\t]+(?:test|run[ \\t]+${SAFE_SCRIPT})|` +
    `pnpm[ \\t]+(?:test|run[ \\t]+${SAFE_SCRIPT})|` +
    `yarn[ \\t]+(?:run[ \\t]+)?${SAFE_SCRIPT}|` +
    `bun[ \\t]+(?:test|run[ \\t]+${SAFE_SCRIPT})|` +
    `${SAFE_NX_RUNNER}[ \\t]+${SAFE_NX_COMMAND}|` +
    `node[ \\t]+(?:--test|--check)` +
    `)(?:[ \\t]+${SAFE_COMMAND_TOKEN})*$`,
);
const MUTATING_VERIFY_FLAG_PATTERN = /^(?:--fix|--write|--update|--updateSnapshot|--updateSnapshots|--update-snapshot|--update-snapshots|--test-update-snapshots|--watch|--watchAll|--watch-all|-u|-w)(?:=|$)/;
const INSTALL_COMMAND_PATTERN = new RegExp(
  `^(?:` +
    `npm[ \\t]+ci|` +
    `pnpm[ \\t]+install[ \\t]+--frozen-lockfile|` +
    `yarn[ \\t]+install[ \\t]+--immutable|` +
    `bun[ \\t]+install[ \\t]+--frozen-lockfile` +
    `)(?:[ \\t]+${SAFE_COMMAND_TOKEN})*$`,
);

function diagnostic(path, message) {
  return { path, message };
}

export function formatDiagnostic(item) {
  return `${item.path}: ${item.message}`;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function displayPath(root, file) {
  return relative(root, file).split(sep).join('/') || '.';
}

function parseFrontmatter(content, file) {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/);
  const diagnostics = [];

  if (lines[0] !== '---') {
    return {
      data: {},
      lines: [],
      diagnostics: [diagnostic(file, 'missing opening frontmatter delimiter')],
    };
  }

  const closing = lines.indexOf('---', 1);
  if (closing === -1) {
    return {
      data: {},
      lines: lines.slice(1),
      diagnostics: [diagnostic(file, 'missing closing frontmatter delimiter')],
    };
  }

  const data = {};
  for (let index = 1; index < closing; index += 1) {
    const line = lines[index];
    if (line.trim() === '' || line.trimStart().startsWith('#') || /^\s/.test(line)) {
      continue;
    }

    const match = /^([A-Za-z][A-Za-z0-9_-]*):(?:\s*(.*))?$/.exec(line);
    if (!match) {
      diagnostics.push(diagnostic(file, `invalid frontmatter entry on line ${index + 1}`));
      continue;
    }

    let value = (match[2] ?? '').trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    data[match[1]] = value;
  }

  return { data, lines: lines.slice(1, closing), diagnostics };
}

async function markdownFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await markdownFiles(path)));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(path);
    }
  }
  return files;
}

async function validateFrontmatterFile(root, file, fields) {
  const shown = displayPath(root, file);
  let content;
  try {
    content = await readFile(file, 'utf8');
  } catch (error) {
    return {
      data: {},
      lines: [],
      diagnostics: [diagnostic(shown, `cannot read file: ${error.message}`)],
    };
  }

  const parsed = parseFrontmatter(content, shown);
  for (const field of fields) {
    if (typeof parsed.data[field] !== 'string' || parsed.data[field].trim() === '') {
      parsed.diagnostics.push(diagnostic(shown, `frontmatter field "${field}" must be a non-empty value`));
    }
  }
  return parsed;
}

function permissionBlock(lines) {
  const permission = lines.findIndex((line) => /^permission:\s*(?:#.*)?$/.test(line));
  if (permission === -1) return [];

  const block = [];
  for (const line of lines.slice(permission + 1)) {
    if (/^[^\s#]/.test(line)) break;
    if (line.trim() !== '' && !line.trimStart().startsWith('#')) block.push(line);
  }
  return block;
}

function explicitDefaultPermissionAction(lines) {
  const block = permissionBlock(lines);
  if (block.length === 0) return undefined;

  const topLevelIndent = Math.min(...block.map((line) => /^\s*/.exec(line)[0].length));
  for (const line of block) {
    const match = /^(\s+)(?:"\*"|'\*'|\*):\s*(allow|deny)\s*(?:#.*)?$/.exec(line);
    if (match !== null && match[1].length === topLevelIndent) return match[2];
  }
  return undefined;
}

function hasAskPermissionAction(lines) {
  return permissionBlock(lines).some((line) =>
    /:\s*(?:ask|"ask"|'ask')\s*(?:#.*)?$/.test(line),
  );
}

function validateProductionNames(path, label, actual, expected) {
  const diagnostics = [];
  const actualNames = new Set(actual);
  const expectedNames = new Set(expected);
  for (const name of expected) {
    if (!actualNames.has(name)) {
      diagnostics.push(diagnostic(path, `missing required production ${label} "${name}"`));
    }
  }
  for (const name of [...actualNames].sort()) {
    if (!expectedNames.has(name)) {
      diagnostics.push(diagnostic(`${path}/${name}`, `unexpected production ${label} name "${name}"`));
    }
  }
  return diagnostics;
}

async function validateSkills(root, { requireProductionAssets = false } = {}) {
  const skillsRoot = join(root, 'skills');
  let entries;
  try {
    entries = await readdir(skillsRoot, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      const diagnostics = [diagnostic('skills', 'directory does not exist')];
      if (requireProductionAssets) {
        diagnostics.push(...validateProductionNames('skills', 'skill', [], PRODUCTION_SKILLS));
      }
      return diagnostics;
    }
    return [diagnostic('skills', `cannot read directory: ${error.message}`)];
  }

  const diagnostics = [];
  if (requireProductionAssets) {
    diagnostics.push(
      ...validateProductionNames(
        'skills',
        'skill',
        entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name),
        PRODUCTION_SKILLS,
      ),
    );
  }
  if (!entries.some((entry) => entry.isDirectory())) {
    diagnostics.push(diagnostic('skills', 'no skill folders found'));
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const file = join(skillsRoot, entry.name, 'SKILL.md');
    let content;
    try {
      content = await readFile(file, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        diagnostics.push(diagnostic(`skills/${entry.name}`, 'missing SKILL.md'));
      } else {
        diagnostics.push(diagnostic(`skills/${entry.name}/SKILL.md`, `cannot read file: ${error.message}`));
      }
      continue;
    }

    const shown = `skills/${entry.name}/SKILL.md`;
    const parsed = parseFrontmatter(content, shown);
    diagnostics.push(...parsed.diagnostics);
    for (const field of SKILL_FIELDS) {
      if (typeof parsed.data[field] !== 'string' || parsed.data[field].trim() === '') {
        diagnostics.push(diagnostic(shown, `frontmatter field "${field}" must be a non-empty value`));
      }
    }
    if (parsed.data.name && !SKILL_NAME_PATTERN.test(parsed.data.name)) {
      diagnostics.push(
        diagnostic(shown, `skill name "${parsed.data.name}" must match ${SKILL_NAME_PATTERN}`),
      );
    }
    if (parsed.data.name && parsed.data.name !== entry.name) {
      diagnostics.push(
        diagnostic(shown, `skill name "${parsed.data.name}" must match folder "${entry.name}"`),
      );
    }
  }
  return diagnostics;
}

async function validateTemplate(root, agents) {
  const shown = 'templates/opencode.json';
  let config;
  try {
    config = JSON.parse(await readFile(join(root, shown), 'utf8'));
  } catch (error) {
    const reason = error.code === 'ENOENT' ? 'file does not exist' : `cannot parse JSON: ${error.message}`;
    return [diagnostic(shown, reason)];
  }

  if (!isRecord(config)) return [diagnostic(shown, 'template must be a JSON object')];

  const diagnostics = [];
  const defaultAgent = config.default_agent;
  if (
    typeof defaultAgent !== 'string' ||
    defaultAgent.trim() === '' ||
    agents.get(defaultAgent)?.mode !== 'primary'
  ) {
    diagnostics.push(
      diagnostic(`${shown}.default_agent`, 'must reference an existing primary agent'),
    );
  }

  const skillPaths = config.skills?.paths;
  if (
    !Array.isArray(skillPaths) ||
    skillPaths.length === 0 ||
    skillPaths.some((value) => typeof value !== 'string' || value.trim() === '')
  ) {
    diagnostics.push(
      diagnostic(`${shown}.skills.paths`, 'must be a non-empty array of non-empty strings'),
    );
  }
  return diagnostics;
}

export async function validateDistribution(
  root = process.cwd(),
  { requireProductionAssets = true } = {},
) {
  const absoluteRoot = resolve(root);
  const diagnostics = [];
  try {
    const info = await stat(absoluteRoot);
    if (!info.isDirectory()) return [diagnostic('.', `distribution root is not a directory: ${absoluteRoot}`)];
  } catch (error) {
    const reason = error.code === 'ENOENT' ? 'does not exist' : `cannot be read: ${error.message}`;
    return [diagnostic('.', `distribution root ${reason}: ${absoluteRoot}`)];
  }

  const agents = new Map();
  const agentsRoot = join(absoluteRoot, 'agents');
  const agentFiles = await markdownFiles(agentsRoot);
  const agentNames = agentFiles.map((file) => displayPath(agentsRoot, file).slice(0, -3));
  const hasAllProductionAgents = PRODUCTION_AGENTS.every((name) => agentNames.includes(name));
  if (agentFiles.length === 0) diagnostics.push(diagnostic('agents', 'no Markdown files found'));
  if (requireProductionAssets) {
    diagnostics.push(
      ...validateProductionNames(
        'agents',
        'agent',
        agentNames,
        PRODUCTION_AGENTS,
      ),
    );
  }
  for (const file of agentFiles) {
    const parsed = await validateFrontmatterFile(absoluteRoot, file, AGENT_FIELDS);
    diagnostics.push(...parsed.diagnostics);
    const shown = displayPath(absoluteRoot, file);
    const name = displayPath(agentsRoot, file).slice(0, -3);
    agents.set(name, parsed.data);
    if (
      typeof parsed.data.mode === 'string' &&
      parsed.data.mode.trim() !== '' &&
      !AGENT_MODES.has(parsed.data.mode)
    ) {
      diagnostics.push(
        diagnostic(shown, 'frontmatter field "mode" must be primary, subagent, or all'),
      );
    }
    const productionMode = requireProductionAssets ? PRODUCTION_AGENT_MODES.get(name) : undefined;
    if (productionMode !== undefined && parsed.data.mode !== productionMode) {
      diagnostics.push(
        diagnostic(shown, `production agent "${name}" must use mode "${productionMode}"`),
      );
    }
    const defaultPermissionAction = explicitDefaultPermissionAction(parsed.lines);
    if (defaultPermissionAction === undefined) {
      diagnostics.push(
        diagnostic(shown, 'permission must be a block with an explicit top-level "*" action'),
      );
    }
    if (hasAllProductionAgents && productionMode !== undefined && defaultPermissionAction !== 'allow') {
      diagnostics.push(
        diagnostic(shown, `production agent "${name}" must set top-level "*" permission to allow`),
      );
    }
    if (hasAllProductionAgents && productionMode !== undefined && hasAskPermissionAction(parsed.lines)) {
      diagnostics.push(
        diagnostic(shown, `production agent "${name}" permission must not contain ask actions`),
      );
    }
  }

  const commandsRoot = join(absoluteRoot, 'commands');
  const commandFiles = await markdownFiles(commandsRoot);
  if (commandFiles.length === 0) diagnostics.push(diagnostic('commands', 'no Markdown files found'));
  if (requireProductionAssets) {
    diagnostics.push(
      ...validateProductionNames(
        'commands',
        'command',
        commandFiles.map((file) => displayPath(commandsRoot, file).slice(0, -3)),
        PRODUCTION_COMMANDS,
      ),
    );
  }
  for (const file of commandFiles) {
    const parsed = await validateFrontmatterFile(absoluteRoot, file, COMMAND_FIELDS);
    diagnostics.push(...parsed.diagnostics);
    const name = displayPath(commandsRoot, file).slice(0, -3);
    if (
      typeof parsed.data.agent === 'string' &&
      parsed.data.agent.trim() !== '' &&
      !agents.has(parsed.data.agent)
    ) {
      diagnostics.push(
        diagnostic(
          displayPath(absoluteRoot, file),
          `frontmatter field "agent" references missing agent "${parsed.data.agent}"`,
        ),
      );
    }
    const productionAgent = requireProductionAssets
      ? PRODUCTION_COMMAND_AGENTS.get(name)
      : undefined;
    if (productionAgent !== undefined && parsed.data.agent !== productionAgent) {
      diagnostics.push(
        diagnostic(
          displayPath(absoluteRoot, file),
          `production command "${name}" must use agent "${productionAgent}"`,
        ),
      );
    }
  }
  diagnostics.push(...(await validateSkills(absoluteRoot, { requireProductionAssets })));
  diagnostics.push(...(await validateTemplate(absoluteRoot, agents)));
  return diagnostics;
}

function validDocumentPath(value) {
  if (typeof value !== 'string' || value.trim() === '' || value !== value.trim()) return false;
  if (isAbsolute(value) || /^[A-Za-z]:/.test(value) || value.includes('\\')) return false;
  return !value.split('/').some((part) => part === '' || part === '.' || part === '..');
}

function validateNonEmptyString(value, path, diagnostics) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    diagnostics.push(diagnostic(path, 'must be a non-empty string'));
  }
}

function validateCommand(value, path, pattern, message, diagnostics) {
  validateNonEmptyString(value, path, diagnostics);
  if (typeof value === 'string' && value.trim().length > 0 && !pattern.test(value)) {
    diagnostics.push(diagnostic(path, message));
  }
}

function hasMutatingVerificationFlag(value) {
  return value.split(/[ \t]+/).some((token) => MUTATING_VERIFY_FLAG_PATTERN.test(token));
}

function rejectUnknownProperties(value, allowed, path, diagnostics) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) diagnostics.push(diagnostic(`${path}.${key}`, 'unknown property'));
  }
}

export function validateProjectConfig(config, { source = '.opencode/project.json' } = {}) {
  const diagnostics = [];
  if (!isRecord(config)) {
    return [diagnostic(source, 'configuration must be a JSON object')];
  }

  rejectUnknownProperties(
    config,
    new Set(['$schema', 'version', 'commands', 'documents', 'githubProject', 'merge']),
    source,
    diagnostics,
  );

  if (config.$schema !== undefined) {
    validateNonEmptyString(config.$schema, `${source}.$schema`, diagnostics);
  }
  if (config.version !== 1) {
    diagnostics.push(diagnostic(`${source}.version`, 'must equal 1'));
  }
  if (!isRecord(config.commands)) {
    diagnostics.push(diagnostic(`${source}.commands`, 'must be an object'));
  } else {
    rejectUnknownProperties(
      config.commands,
      new Set(['verify', 'install']),
      `${source}.commands`,
      diagnostics,
    );
    validateCommand(
      config.commands.verify,
      `${source}.commands.verify`,
      VERIFY_COMMAND_PATTERN,
      'must use a supported verification command family (safe npm/pnpm/yarn/bun scripts, safe Nx commands, or node --test/--check)',
      diagnostics,
    );
    if (
      typeof config.commands.verify === 'string' &&
      VERIFY_COMMAND_PATTERN.test(config.commands.verify) &&
      hasMutatingVerificationFlag(config.commands.verify)
    ) {
      diagnostics.push(
        diagnostic(
          `${source}.commands.verify`,
          'must not use mutating verification flags (--fix, --write, snapshot update flags, or watch flags)',
        ),
      );
    }
    if (config.commands.install !== undefined) {
      validateCommand(
        config.commands.install,
        `${source}.commands.install`,
        INSTALL_COMMAND_PATTERN,
        'must use npm ci, pnpm install --frozen-lockfile, yarn install --immutable, or bun install --frozen-lockfile',
        diagnostics,
      );
    }
  }

  if (!Array.isArray(config.documents) || config.documents.length === 0) {
    diagnostics.push(diagnostic(`${source}.documents`, 'must be a non-empty array'));
  } else {
    for (const [index, value] of config.documents.entries()) {
      const itemPath = `${source}.documents[${index}]`;
      if (!isRecord(value)) {
        diagnostics.push(diagnostic(itemPath, 'must be an object'));
        continue;
      }
      rejectUnknownProperties(value, new Set(['path', 'purpose']), itemPath, diagnostics);
      if (!validDocumentPath(value.path)) {
        diagnostics.push(
          diagnostic(`${itemPath}.path`, 'must be a safe relative path using forward slashes'),
        );
      }
      validateNonEmptyString(value.purpose, `${itemPath}.purpose`, diagnostics);
      if (config.documents.slice(0, index).some((item) => isDeepStrictEqual(item, value))) {
        diagnostics.push(diagnostic(itemPath, 'duplicates a document object'));
      }
    }
  }

  if (config.githubProject !== undefined) {
    const projectPath = `${source}.githubProject`;
    if (!isRecord(config.githubProject)) {
      diagnostics.push(diagnostic(projectPath, 'must be an object'));
    } else {
      rejectUnknownProperties(
        config.githubProject,
        new Set(['owner', 'number', 'statuses', 'priorityField']),
        projectPath,
        diagnostics,
      );
      validateNonEmptyString(config.githubProject.owner, `${projectPath}.owner`, diagnostics);
      if (!Number.isInteger(config.githubProject.number) || config.githubProject.number <= 0) {
        diagnostics.push(diagnostic(`${projectPath}.number`, 'must be a positive integer'));
      }
      const statusesPath = `${projectPath}.statuses`;
      if (!isRecord(config.githubProject.statuses)) {
        diagnostics.push(diagnostic(statusesPath, 'must be an object'));
      } else {
        const statusNames = ['ready', 'active', 'review', 'done', 'blocked'];
        rejectUnknownProperties(
          config.githubProject.statuses,
          new Set(statusNames),
          statusesPath,
          diagnostics,
        );
        for (const name of statusNames) {
          const value = config.githubProject.statuses[name];
          validateNonEmptyString(
            value,
            `${statusesPath}.${name}`,
            diagnostics,
          );
        }
        const previousStatusByValue = new Map();
        for (const name of statusNames) {
          const value = config.githubProject.statuses[name];
          if (typeof value !== 'string' || value.trim() === '') continue;
          const previous = previousStatusByValue.get(value);
          if (previous !== undefined) {
            diagnostics.push(
              diagnostic(
                `${statusesPath}.${name}`,
                `must differ from status "${previous}"; status values must be pairwise distinct`,
              ),
            );
          } else {
            previousStatusByValue.set(value, name);
          }
        }
      }
      if (config.githubProject.priorityField !== undefined) {
        validateNonEmptyString(
          config.githubProject.priorityField,
          `${projectPath}.priorityField`,
          diagnostics,
        );
      }
    }
  }

  if (!isRecord(config.merge)) {
    diagnostics.push(diagnostic(`${source}.merge`, 'must be an object'));
  } else {
    rejectUnknownProperties(
      config.merge,
      new Set(['method', 'automatic']),
      `${source}.merge`,
      diagnostics,
    );
    if (config.merge.method !== 'squash') {
      diagnostics.push(diagnostic(`${source}.merge.method`, 'must equal "squash"'));
    }
    if (typeof config.merge.automatic !== 'boolean') {
      diagnostics.push(diagnostic(`${source}.merge.automatic`, 'must be a boolean'));
    }
  }
  return diagnostics;
}

export async function validateProject(root = process.cwd(), { checkDocuments = true } = {}) {
  const absoluteRoot = resolve(root);
  const source = '.opencode/project.json';
  const file = join(absoluteRoot, source);
  let config;
  try {
    config = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return [diagnostic(source, 'file does not exist')];
    return [diagnostic(source, `cannot parse JSON: ${error.message}`)];
  }

  const diagnostics = validateProjectConfig(config, { source });
  if (!checkDocuments || !Array.isArray(config.documents)) return diagnostics;

  for (const [index, document] of config.documents.entries()) {
    if (!isRecord(document) || !validDocumentPath(document.path)) continue;
    const documentPath = resolve(absoluteRoot, document.path);
    try {
      await stat(documentPath);
    } catch (error) {
      const reason = error.code === 'ENOENT' ? 'does not exist' : `cannot be read: ${error.message}`;
      diagnostics.push(
        diagnostic(
          `${source}.documents[${index}].path`,
          `referenced document ${reason}: ${document.path}`,
        ),
      );
    }
  }
  return diagnostics;
}
