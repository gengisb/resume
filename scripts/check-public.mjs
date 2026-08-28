import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const trackedFiles = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

const forbiddenFiles = [
  /(^|\/)\.env(?:\.|$)/i,
  /(^|\/)\.dev\.vars(?:\.|$)/i,
  /(^|\/)(?:credentials|secrets?)\.json$/i,
  /(^|\/)id_(?:rsa|ed25519)(?:\.|$)/i,
  /\.(?:pem|key|p12|pfx)$/i,
  /^\.openai\/hosting\.json$/,
];

const privateHost = ['51', '75', '205', '237'].join('\\.');
const privatePort = ['49', '153'].join('');

const forbiddenContent = [
  ['AWS access key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['GitHub token', /\b(?:github_pat_[A-Za-z0-9_]+|gh[pousr]_[A-Za-z0-9]+)\b/],
  ['GitLab token', /\bglpat-[A-Za-z0-9_-]+\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]+\b/],
  ['Hugging Face token', /\bhf_[A-Za-z0-9]{20,}\b/],
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['credential embedded in URL', /https?:\/\/[^/@\s]+:[^/@\s]+@/],
  ['macOS user path', /\/Users\/[^/\s]+\//],
  ['Linux home path', /\/home\/[^/\s]+\//],
  ['internal Sites project binding', /\bappgprj_[A-Za-z0-9]+\b/],
  ['internal Codex Git remote', /\bgit\.chatgpt-team\.site\b/],
  ['private deployment address', new RegExp(`\\b${privateHost}\\b|\\b${privatePort}\\b`)],
];

const findings = [];
for (const file of trackedFiles) {
  if (forbiddenFiles.some((pattern) => pattern.test(file))) {
    findings.push(`${file}: sensitive filename`);
    continue;
  }

  const bytes = await readFile(file);
  if (bytes.includes(0)) continue;
  const content = bytes.toString('utf8');
  for (const [label, pattern] of forbiddenContent) {
    if (file.startsWith('public/vendor/') && (label === 'macOS user path' || label === 'Linux home path')) continue;
    if (pattern.test(content)) findings.push(`${file}: ${label}`);
  }
}

if (findings.length) {
  console.error('Public-release check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log(`Public-release check passed for ${trackedFiles.length} tracked files.`);
}
