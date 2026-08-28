import { commandModules } from '../src/commands/index.js';
import { renderCommand } from '../src/commands/define-command.js';
import { resumeConfig } from '../src/resume.config.js';

const systemCommands = new Set(['/help', '/model', '/ai', '/effort', '/clear']);
const commandNames = commandModules.map((command) => command.name);
const uniqueNames = new Set(commandNames);
if (uniqueNames.size !== commandNames.length) throw new Error('Command names must be unique.');

const aliases = new Set();
for (const command of commandModules) {
  for (const alias of command.aliases) {
    if (uniqueNames.has(alias) || aliases.has(alias)) throw new Error(`Duplicate command alias: ${alias}`);
    aliases.add(alias);
  }
}

function validateProfile(profile, label) {
  const requiredArrays = ['quickCommands', 'skills', 'impact', 'contact'];
  for (const key of requiredArrays) {
    if (!Array.isArray(profile[key])) throw new Error(`${label} profile needs an array at ${key}.`);
  }
  if (!profile.site || !profile.header || !profile.jobs || !profile.context || !profile.ai) throw new Error(`${label} profile is missing a required section.`);

  for (const quickCommand of profile.quickCommands) {
    if (!uniqueNames.has(quickCommand) && !systemCommands.has(quickCommand)) throw new Error(`${label} profile has an unknown quick command: ${quickCommand}`);
  }
  for (const section of profile.ai.alwaysInclude) {
    if (!profile.ai.sections[section]) throw new Error(`${label} profile has an unknown always-included AI section: ${section}`);
  }
  for (const [section] of profile.ai.routes) {
    if (!profile.ai.sections[section]) throw new Error(`${label} profile has an unknown routed AI section: ${section}`);
  }

  globalThis.window = { location: { href: 'http://localhost:3210/' } };
  for (const command of commandModules) {
    if (command.dataKey && !Object.hasOwn(profile, command.dataKey) && command.defaults === undefined) {
      throw new Error(`${label} profile has no data for ${command.name} (${command.dataKey}).`);
    }
    const output = renderCommand(command, profile);
    if (typeof output !== 'string' || !output.trim()) throw new Error(`${command.name} returned no output for the ${label} profile.`);
  }
}

validateProfile(resumeConfig, 'active');

console.log(`Validated ${commandModules.length} command modules, ${aliases.size} aliases, and the profile.`);
