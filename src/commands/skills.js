import { escapeHtml } from '../lib/html.js';
import { defineCommand } from './define-command.js';

export default defineCommand({
  name: '/skills',
  description: 'Browse core skills',
  dataKey: 'skills',
  defaults: [],
  render: ({ data }) => `<div class="skills-grid">${data.map(({ title, items }) => `<div><h3>${escapeHtml(title)}</h3><p>${items.map(escapeHtml).join(' • ')}</p></div>`).join('')}</div>`,
});
