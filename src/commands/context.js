import { bot, escapeHtml } from '../lib/html.js';
import { defineCommand } from './define-command.js';

export default defineCommand({
  name: '/context',
  description: 'Visualize career context',
  dataKey: 'context',
  render: ({ data }) => {
    const cells = Object.entries(data.cells).flatMap(([type, count]) => Array(count).fill(type));
    const heatmap = cells.map((type) => type === 'future' ? bot() : `<span class="context-token ${escapeHtml(type)}"></span>`).join('');
    const legend = data.legend.map(({ type, label, value }) => `<div class="legend-row"><span class="context-token ${escapeHtml(type)}"></span><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`).join('');
    return `<div class="context-panel"><div><h3>Context Usage</h3><div class="context-grid" aria-label="Career context heatmap">${heatmap}</div><p class="meta">${escapeHtml(data.loaded)}</p></div><div class="context-legend"><p class="legend-title">Estimated context by career era</p>${legend}<div class="legend-row anthropic-row">${bot()}<strong>${escapeHtml(data.futureLabel)}</strong><span>${escapeHtml(data.futureValue)}</span></div></div></div>`;
  },
});
