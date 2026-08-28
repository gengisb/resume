import { escapeHtml } from '../lib/html.js';
import { defineCommand } from './define-command.js';

function jobMarkup(job) {
  return `<article class="job-card"><h3>${escapeHtml(job.title)} <span class="divider">|</span> <span class="accent">${escapeHtml(job.company)}</span></h3><p class="meta">${escapeHtml(job.dates)} <span>•</span> ${escapeHtml(job.location)}</p><p class="tech"><span>TECH</span> ${job.tech.map(escapeHtml).join(' • ')}</p><ul>${job.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('')}</ul></article>`;
}

function renderExperience(data, includeAll) {
  const jobs = includeAll ? [...data.recent, ...data.earlier] : data.recent;
  const continuation = includeAll ? '' : '<p class="hint">↳ type <button data-run="/experience --all">/experience --all</button> for the full history</p>';
  return `<div class="jobs">${jobs.map(jobMarkup).join('')}${continuation}</div>`;
}

export const experienceCommands = [
  defineCommand({ name: '/experience', description: 'Show recent experience', aliases: ['/experience --recent', '/experience --verbose'], dataKey: 'jobs', defaults: { recent: [], earlier: [] }, render: ({ data }) => renderExperience(data, false) }),
  defineCommand({ name: '/experience --all', description: 'Show full career history', aliases: ['/continue'], dataKey: 'jobs', defaults: { recent: [], earlier: [] }, render: ({ data }) => renderExperience(data, true) }),
];
