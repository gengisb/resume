import { escapeHtml, safeHref } from '../lib/html.js';
import { defineCommand } from './define-command.js';

function labelMarkup(item) {
  return `<span class="contact-label"><span class="contact-icon ${escapeHtml(item.kind)}" aria-hidden="true">${escapeHtml(item.mark)}</span>${escapeHtml(item.label)}</span>`;
}

export default defineCommand({
  name: '/contact',
  description: 'Get contact details',
  aliases: ['/contact --copy'],
  dataKey: 'contact',
  defaults: [],
  render: ({ data }) => `<div class="contact-grid">${data.map((item) => `${labelMarkup(item)}${item.href ? `<a href="${safeHref(item.href)}" target="${item.href.startsWith('mailto:') ? '_self' : '_blank'}" rel="noreferrer">${escapeHtml(item.value)}</a>` : `<b>${escapeHtml(item.value)}</b>`}`).join('')}</div>`,
});
