#!/usr/bin/env node

import process from 'node:process';
import { resolve } from 'node:path';
import { installGlobal } from '../lib/install.mjs';
import {
  formatDiagnostic,
  validateDistribution,
  validateProject,
} from '../lib/validation.mjs';

const usage = `Usage: governance <command> [options]

Commands:
  validate-distribution [root]  Validate distributed agents, commands, tools, skills, and issue contract
  validate-project [repo]       Validate .opencode/project.json and its documents
  install-global [options]      Install agents, commands, tools, and skills globally
  help                          Show this help

install-global options:
  --config-home PATH            Config home (default: ~/.config/opencode)
  --skills-home PATH            Skills home (default: /workspace/skills/skills)
  --apply                       Apply the planned writes (default: dry run)
`;

function parseInstallOptions(args) {
  const options = { apply: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--apply') {
      options.apply = true;
      continue;
    }

    let name = argument;
    let value;
    const equals = argument.indexOf('=');
    if (equals !== -1) {
      name = argument.slice(0, equals);
      value = argument.slice(equals + 1);
    }
    if (name !== '--config-home' && name !== '--skills-home') {
      throw new Error(`unknown install-global option: ${argument}`);
    }
    if (value === undefined) {
      value = args[index + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`${name} requires a path`);
      }
      index += 1;
    }
    if (value === '') throw new Error(`${name} requires a path`);
    options[name === '--config-home' ? 'configHome' : 'skillsHome'] = value;
  }
  return options;
}

function printPlan(result) {
  process.stdout.write('Planned writes:\n');
  for (const entry of result.entries) {
    process.stdout.write(`  ${entry.destination} [${entry.status}]\n`);
  }
  for (const conflict of result.conflicts) {
    if (result.entries.some((entry) => entry.destination === conflict.destination)) continue;
    process.stdout.write(`  ${conflict.destination} [conflict: ${conflict.reason}]\n`);
  }
  process.stdout.write('Dry run complete; no changes made. Use --apply to install.\n');
}

async function runInstallGlobal(args) {
  const options = parseInstallOptions(args);
  const result = await installGlobal(options);
  if (!options.apply) {
    printPlan(result);
    return 0;
  }
  if (result.conflicts.length > 0) {
    for (const conflict of result.conflicts) {
      process.stderr.write(`Conflict: ${conflict.destination}: ${conflict.reason}\n`);
    }
    process.stderr.write(
      `Installation aborted with ${result.conflicts.length} conflict(s); no files were written.\n`,
    );
    return 1;
  }

  const identical = result.entries.filter((entry) => entry.status === 'identical').length;
  process.stdout.write(
    `Installation complete: ${result.written.length} file(s) written, ${identical} identical file(s) unchanged.\n`,
  );
  return 0;
}

async function run() {
  const [command = 'help', ...args] = process.argv.slice(2);

  if (command === 'help' || command === '--help' || command === '-h') {
    process.stdout.write(usage);
    return 0;
  }

  if (command === 'install-global') {
    return runInstallGlobal(args);
  }
  const [location, ...extra] = args;
  if (extra.length > 0) {
    process.stderr.write(`Too many arguments for ${command}\n\n${usage}`);
    return 2;
  }
  const root = resolve(location ?? process.cwd());
  let diagnostics;

  if (command === 'validate-distribution') {
    diagnostics = await validateDistribution(root);
  } else if (command === 'validate-project') {
    diagnostics = await validateProject(root);
  } else {
    process.stderr.write(`Unknown command: ${command}\n\n${usage}`);
    return 2;
  }

  if (diagnostics.length > 0) {
    for (const item of diagnostics) {
      process.stderr.write(`${formatDiagnostic(item)}\n`);
    }
    process.stderr.write(`Validation failed with ${diagnostics.length} error(s).\n`);
    return 1;
  }

  process.stdout.write(`Validation passed: ${root}\n`);
  return 0;
}

try {
  process.exitCode = await run();
} catch (error) {
  process.stderr.write(`Command failed: ${error.message}\n`);
  process.exitCode = 2;
}
