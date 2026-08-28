import { escapeHtml } from '../lib/html.js';
import { defineCommand } from './define-command.js';

export default defineCommand({
  name: '/impact',
  description: 'Show selected outcomes',
  aliases: ['/impact --highlights'],
  dataKey: 'impact',
  defaults: [],
  render: ({ data }) => `<ul class="star-list">${data.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`,
});
