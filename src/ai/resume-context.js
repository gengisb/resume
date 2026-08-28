import { resumeConfig } from '../resume.config.js';
import { commandModules } from '../commands/index.js';
import { commandAiContext } from '../commands/define-command.js';

export const localAiSystemPrompt = resumeConfig.ai.systemPrompt;

export function getLocalAiContext(messages) {
  const userMessages = messages.filter((message) => message.role === 'user');
  const currentPrompt = userMessages.at(-1)?.content || '';
  let matches = resumeConfig.ai.routes.filter(([, pattern]) => pattern.test(currentPrompt));
  if (!matches.length) {
    const recentUserText = userMessages.slice(-3).map((message) => message.content).join(' ');
    matches = resumeConfig.ai.routes.filter(([, pattern]) => pattern.test(recentUserText));
  }
  const alwaysAvailable = resumeConfig.ai.alwaysInclude.map((section) => resumeConfig.ai.sections[section]);
  const selected = matches.map(([section]) => resumeConfig.ai.sections[section]);
  const matchedSections = new Set(matches.map(([section]) => section));
  const moduleContext = commandModules
    .filter((command) => command.aiContext && matchedSections.has(command.dataKey))
    .map((command) => commandAiContext(command, resumeConfig));
  return [resumeConfig.ai.coreContext, ...new Set([...alwaysAvailable, ...selected, ...moduleContext])].join('\n\n');
}
