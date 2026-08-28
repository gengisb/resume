import contact from './contact.js';
import context from './context.js';
import { experienceCommands } from './experience.js';
import impact from './impact.js';
import pacman from './pacman.js';
import skills from './skills.js';
import whoami from './whoami.js';

// Add a new command module here. The terminal engine reads this registry
// automatically for routing, autocomplete, aliases, and /help.
export const commandModules = [
  whoami,
  ...experienceCommands,
  context,
  skills,
  impact,
  pacman,
  contact,
];

export const commandRegistry = new Map(commandModules.map((command) => [command.name, command]));
export const commandAliases = new Map(commandModules.flatMap((command) => command.aliases.map((alias) => [alias, command.name])));
