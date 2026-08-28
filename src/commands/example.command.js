import { escapeHtml } from '../lib/html.js';
import { defineCommand } from './define-command.js';

// Copy this file, rename the command, then add it to commands/index.js.
export default defineCommand({
  name: '/now',
  description: 'Show what you are working on now',
  aliases: ['/current'],
  render: () => `<div class="profile-summary command-summary"><p>${escapeHtml('Building useful things at the intersection of software and AI.')}</p></div>`,
});
