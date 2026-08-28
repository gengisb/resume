export function defineCommand({ name, description, aliases = [], dataKey = null, defaults, render, aiContext = null, onRender = null, showInHelp = true }) {
  if (!name?.startsWith('/')) throw new Error(`Command names must start with "/": ${name}`);
  if (typeof render !== 'function') throw new Error(`Command ${name} needs a render function.`);
  if (dataKey !== null && typeof dataKey !== 'string') throw new Error(`Command ${name} has an invalid data key.`);
  if (aiContext !== null && typeof aiContext !== 'function') throw new Error(`Command ${name} has an invalid AI context provider.`);
  if (onRender !== null && typeof onRender !== 'function') throw new Error(`Command ${name} has an invalid onRender hook.`);
  return Object.freeze({ name, description, aliases, dataKey, defaults, render, aiContext, onRender, showInHelp });
}

export function commandData(command, profile) {
  if (!command.dataKey) return undefined;
  return Object.hasOwn(profile, command.dataKey) ? profile[command.dataKey] : command.defaults;
}

export function renderCommand(command, profile) {
  return command.render({ profile, data: commandData(command, profile) });
}

export function commandAiContext(command, profile) {
  return command.aiContext?.({ profile, data: commandData(command, profile) }) || '';
}
