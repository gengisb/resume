import { escapeHtml } from '../lib/html.js';
import { defineCommand } from './define-command.js';

export default defineCommand({
  name: '/whoami',
  description: 'Show profile summary',
  dataKey: 'header',
  render: ({ data }) => `<div class="profile-summary command-summary"><p>${escapeHtml(data.summary)}</p><span><b>CURRENT FOCUS</b> ${escapeHtml(data.focus)}</span></div>`,
});
