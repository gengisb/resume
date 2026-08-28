import { getLocalAiContext, localAiSystemPrompt } from './ai/resume-context.js';
import { commandAliases, commandModules, commandRegistry } from './commands/index.js';
import { renderCommand } from './commands/define-command.js';
import { bot, escapeHtml, safeHref } from './lib/html.js';
import { resumeConfig } from './resume.config.js';

const systemCommandHelp = [
  ['/help', 'List available commands'],
  ['/model', 'Show the local model selector'],
  ['/ai', 'Load the in-browser local model'],
  ['/effort', 'Configure reasoning and output'],
  ['/clear', 'Clear terminal history'],
];
const commandHelp = [
  systemCommandHelp[0],
  ...commandModules.filter((command) => command.showInHelp).map((command) => [command.name, command.description]),
  ...systemCommandHelp.slice(1),
];
const commands = [...commandHelp.map(([command]) => command), ...commandAliases.keys()];
const WEBLLM_URL = new URL('./vendor/web-llm-0.2.84-d1ecb257.js', window.location.href).href;
const TRANSFORMERS_URL = new URL('./vendor/transformers-4.0.0-next.3-web-20260827b.min.js', window.location.href).href;
const ONNX_WEBGPU_FACTORY_URL = new URL('./vendor/ort-wasm-simd-threaded.asyncify-20260827b.js', window.location.href).href;
const ONNX_WEBGPU_WASM_URL = new URL('./vendor/ort-wasm-simd-threaded.asyncify-20260827b.wasm', window.location.href).href;
const MODEL_DEFINITIONS = {
  qwen: {
    key: 'qwen',
    runtime: 'webllm',
    modelId: 'Qwen3.5-2B-q4f16_1-MLC',
    modelUrl: 'https://huggingface.co/mlc-ai/Qwen3.5-2B-q4f16_1-MLC',
    modelLibUrl: new URL('./vendor/Qwen3.5-2B-q4f16_1-webgpu-b0f951d4.wasm', window.location.href).href,
    name: 'Qwen 3.5 · 2B',
    shortName: 'Qwen 3.5 2B',
    detail: 'q4f16 · WebLLM · first load ~1.1 GB',
    badge: 'q4f16 · WebLLM',
    positioning: 'recommended default',
    size: '~1.1 GB',
    supportsReasoning: true,
    readyMessage: 'Qwen 3.5 2B is ready. Ask about this resume or its owner.',
  },
  liquid: {
    key: 'liquid',
    runtime: 'transformers',
    modelId: 'LiquidAI/LFM2.5-1.2B-Thinking-ONNX',
    name: 'LiquidAI LFM2.5 · 1.2B Thinking',
    shortName: 'LFM2.5 1.2B Thinking',
    detail: 'Q4 · ONNX WebGPU · first load ~1.2 GB',
    badge: 'Q4 · ONNX WebGPU',
    positioning: 'experimental',
    size: '~1.2 GB',
    supportsReasoning: true,
    readyMessage: 'LFM2.5 1.2B Thinking is ready. Ask about this resume or its owner.',
  },
};
const output = document.querySelector('#terminal-output');
const form = document.querySelector('#terminal-form');
const input = document.querySelector('#terminal-command');
const terminalShell = document.querySelector('.terminal-shell');
const modeIndicator = document.querySelector('#mode-indicator');
const effortPanel = document.querySelector('#effort-panel');
const effortTrigger = document.querySelector('#effort-trigger');
const effortApply = document.querySelector('#effort-apply');
const reasoningToggle = document.querySelector('#reasoning-toggle');
const effortOptions = [...document.querySelectorAll('[data-effort]')];
const budgetOptions = [...document.querySelectorAll('[data-budget]')];
const generationBudgets = [1024, 2048, 4096];

function hydrateResumeShell() {
  const { site, header, quickCommands } = resumeConfig;
  document.title = site.title;
  const description = document.querySelector('meta[name="description"]');
  if (description) description.content = site.description;
  const textBindings = [
    ['[data-terminal-name]', site.terminalName],
    ['[data-terminal-version]', site.terminalVersion],
    ['[data-profile-welcome]', header.welcome],
    ['[data-profile-mobile-name]', header.mobileName],
    ['[data-profile-tagline]', header.tagline],
    ['[data-profile-mobile-tagline]', header.mobileTagline],
    ['[data-profile-name]', header.name],
    ['[data-profile-label]', header.label],
    ['[data-profile-summary]', header.summary],
    ['[data-profile-focus]', header.focus],
  ];
  textBindings.forEach(([selector, value]) => {
    const node = document.querySelector(selector);
    if (node) node.textContent = value;
  });
  const links = document.querySelector('[data-profile-links]');
  if (links) {
    links.innerHTML = header.links.map((item) => item.href
      ? `<a href="${safeHref(item.href)}"${item.href.startsWith('mailto:') ? '' : ' target="_blank" rel="noreferrer"'}>${escapeHtml(item.label)}</a>`
      : `<span>${escapeHtml(item.label)}</span>`).join('');
  }
  const quickCommandBar = document.querySelector('[data-quick-commands]');
  if (quickCommandBar) quickCommandBar.innerHTML = quickCommands.map((command) => `<button data-run="${escapeHtml(command)}">${escapeHtml(command)}</button>`).join('');
}

hydrateResumeShell();

function getVisibleViewportBottom(inset = 0) {
  const viewport = window.visualViewport;
  return (viewport ? viewport.offsetTop + viewport.height : window.innerHeight) - inset;
}

function syncKeyboardInset() {
  const viewport = window.visualViewport;
  if (!viewport) return;
  const layoutHeight = Math.max(window.innerHeight, document.documentElement.clientHeight);
  const occludedHeight = Math.max(0, layoutHeight - viewport.height - viewport.offsetTop);
  const keyboardInset = document.activeElement === input && occludedHeight > 80 ? occludedHeight : 0;
  document.documentElement.style.setProperty('--keyboard-inset', `${Math.round(keyboardInset)}px`);
}
let history = [];
let historyIndex = -1;
let modeIndex = 2;
const savedEffortIndex = Number.parseInt(localStorage.getItem('resume-reasoning-effort') ?? '0', 10);
let effortIndex = Number.isInteger(savedEffortIndex) && savedEffortIndex >= 0 && savedEffortIndex < effortOptions.length ? savedEffortIndex : 0;
let draftEffortIndex = effortIndex;
let reasoningEnabled = localStorage.getItem('resume-reasoning-enabled-v2') === 'true';
let draftReasoningEnabled = reasoningEnabled;
const savedBudgetIndex = Number.parseInt(localStorage.getItem('resume-generation-budget') ?? '2', 10);
let budgetIndex = Number.isInteger(savedBudgetIndex) && savedBudgetIndex >= 0 && savedBudgetIndex < generationBudgets.length ? savedBudgetIndex : 2;
let draftBudgetIndex = budgetIndex;
const MODEL_DEFAULT_VERSION = 'qwen-default-v1';
const savedModelKey = localStorage.getItem('resume-local-model');
const savedModelDefaultVersion = localStorage.getItem('resume-model-default-version');
const savedModelIsValid = Boolean(MODEL_DEFINITIONS[savedModelKey]);
let selectedModelKey = savedModelDefaultVersion === MODEL_DEFAULT_VERSION && savedModelIsValid
  ? savedModelKey
  : 'qwen';
if (savedModelDefaultVersion !== MODEL_DEFAULT_VERSION || !savedModelIsValid) {
  localStorage.setItem('resume-local-model', selectedModelKey);
  localStorage.setItem('resume-model-default-version', MODEL_DEFAULT_VERSION);
}
let loadedModelKey = null;
let localAiEngine = null;
let localAiWorker = null;
let localAiState = 'idle';
let localAiProgress = 0;
let localAiActive = false;
let localAiBusy = false;
let localAiMessages = [];

const modes = [
  { className: 'mode-accept', label: '⏵⏵ accept edits on' },
  { className: 'mode-plan', label: '⏸ plan mode on' },
  { className: 'mode-auto', label: '▶▶ auto mode on' },
];

const reasoningGuidance = [
  'Use only a short private reasoning pass before answering.',
  'Use a concise private reasoning pass before answering.',
  'Reason privately with moderate care before answering.',
  'Reason privately and thoroughly before answering.',
  'Use your deepest useful private reasoning before answering.',
];

function updateEffortTrigger() {
  effortTrigger.textContent = reasoningEnabled ? effortOptions[effortIndex].textContent : 'off';
  effortTrigger.title = `${reasoningEnabled ? `${effortOptions[effortIndex].textContent} reasoning` : 'reasoning off'} · ${generationBudgets[budgetIndex] / 1024}K generation`;
}

updateEffortTrigger();

function renderInlineMarkdown(value) {
  const protectedMarkup = [];
  const protect = (markup) => `\uE000${protectedMarkup.push(markup) - 1}\uE001`;
  let html = escapeHtml(value);
  html = html.replace(/`([^`\n]+)`/g, (_, code) => protect(`<code>${code}</code>`));
  html = html.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => protect(`<a href="${url}" target="_blank" rel="noreferrer">${label}</a>`));
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
  html = html.replace(/(^|[\s(])\*([^*\n]+)\*(?=$|[\s).,!?:;])/g, '$1<em>$2</em>');
  html = html.replace(/\uE000(\d+)\uE001/g, (_, index) => protectedMarkup[Number(index)]);
  return html;
}

const keywordGroups = {
  javascript: 'async await break case catch class const continue debugger default delete do else export extends finally for from function get if import in instanceof let new of return set static super switch throw try typeof var void while with yield true false null undefined',
  typescript: 'abstract any as asserts async await boolean break case catch class const constructor continue debugger declare default delete do else enum export extends false finally for from function get if implements import in infer instanceof interface is keyof let namespace never new null number object of override private protected public readonly require return satisfies set static string super switch symbol this throw true try type typeof undefined unique unknown var void while with yield',
  python: 'and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield',
  shell: 'case do done elif else esac export fi for function if in local readonly return select then time until while',
  css: 'important inherit initial revert unset',
  json: 'true false null',
};

const languageAliases = {
  bash: 'shell',
  cjs: 'javascript',
  html: 'markup',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  py: 'python',
  sh: 'shell',
  ts: 'typescript',
  tsx: 'typescript',
  xml: 'markup',
};

function highlightCode(value, requestedLanguage = '') {
  const language = languageAliases[requestedLanguage.toLowerCase()] || requestedLanguage.toLowerCase();
  const keywords = new Set((keywordGroups[language] || '').split(' ').filter(Boolean));
  const tokenParts = [];
  if (language === 'markup') tokenParts.push('<!--[\\s\\S]*?-->', '<\\/?[A-Za-z][^>]*>');
  if (!['json', 'markup'].includes(language)) tokenParts.push('\\/\\*[\\s\\S]*?\\*\\/', '\\/\\/[^\\n]*');
  if (['python', 'shell'].includes(language)) tokenParts.push('#[^\\n]*');
  tokenParts.push('`(?:\\\\.|[^`\\\\])*`', '"(?:\\\\.|[^"\\\\])*"', "'(?:\\\\.|[^'\\\\])*'", '\\b\\d+(?:\\.\\d+)?\\b', '\\b[A-Za-z_$][\\w$]*\\b');
  const tokens = new RegExp(tokenParts.join('|'), 'gm');
  let cursor = 0;
  let result = '';

  for (const match of value.matchAll(tokens)) {
    const token = match[0];
    const index = match.index;
    result += escapeHtml(value.slice(cursor, index));
    let kind = '';
    if (token.startsWith('//') || token.startsWith('/*') || token.startsWith('#') || token.startsWith('<!--')) kind = 'comment';
    else if (/^[`"']/.test(token)) kind = 'string';
    else if (/^\d/.test(token)) kind = 'number';
    else if (language === 'markup' && token.startsWith('<')) kind = 'keyword';
    else if (keywords.has(token)) kind = 'keyword';
    else if (/^\s*\(/.test(value.slice(index + token.length))) kind = 'function';
    result += kind ? `<span class="tok-${kind}">${escapeHtml(token)}</span>` : escapeHtml(token);
    cursor = index + token.length;
  }
  return result + escapeHtml(value.slice(cursor));
}

function renderCodeBlock(lines, language) {
  const normalizedLanguage = language.toLowerCase();
  const label = normalizedLanguage || 'code';
  return `<pre class="code-block" data-language="${escapeHtml(label)}"><button type="button" class="code-download" data-code-download aria-label="Download ${escapeHtml(label)} code">download ↓</button><code>${highlightCode(lines.join('\n'), normalizedLanguage)}</code></pre>`;
}

const codeFileExtensions = {
  c: 'c',
  cpp: 'cpp',
  csharp: 'cs',
  css: 'css',
  go: 'go',
  java: 'java',
  javascript: 'js',
  json: 'json',
  markdown: 'md',
  markup: 'html',
  php: 'php',
  python: 'py',
  ruby: 'rb',
  rust: 'rs',
  shell: 'sh',
  sql: 'sql',
  tex: 'tex',
  typescript: 'ts',
  yaml: 'yaml',
};

function downloadCodeBlock(button) {
  const block = button.closest('.code-block');
  const code = block?.querySelector('code')?.textContent;
  if (!block || code === undefined) return;
  const extension = codeFileExtensions[block.dataset.language] || 'txt';
  const blobUrl = URL.createObjectURL(new Blob([code], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = `generated-code-${Date.now()}.${extension}`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  const originalLabel = button.textContent;
  button.textContent = 'downloaded ✓';
  window.setTimeout(() => { button.textContent = originalLabel; }, 1200);
}

function renderBasicMarkdown(value) {
  const lines = value.replace(/\r\n?/g, '\n').split('\n');
  const html = [];
  let paragraph = [];
  let listType = '';
  let codeLanguage = '';
  let codeLines = null;

  const closeParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${paragraph.map(renderInlineMarkdown).join('<br>')}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = '';
  };

  for (const line of lines) {
    if (codeLines) {
      if (/^\s*```\s*$/.test(line)) {
        html.push(renderCodeBlock(codeLines, codeLanguage));
        codeLines = null;
        codeLanguage = '';
      } else {
        codeLines.push(line);
      }
      continue;
    }
    const fence = line.match(/^\s*```([A-Za-z0-9_+#.-]*)\s*$/);
    if (fence) {
      closeParagraph();
      closeList();
      codeLanguage = fence[1] || '';
      codeLines = [];
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed) {
      closeParagraph();
      closeList();
      continue;
    }
    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    const unordered = trimmed.match(/^[-*]\s+(.+)$/);
    const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    const quote = trimmed.match(/^>\s?(.+)$/);
    if (heading) {
      closeParagraph();
      closeList();
      const level = Math.min(heading[1].length + 2, 5);
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
    } else if (unordered || ordered) {
      closeParagraph();
      const nextListType = unordered ? 'ul' : 'ol';
      if (listType !== nextListType) {
        closeList();
        listType = nextListType;
        html.push(`<${listType}>`);
      }
      html.push(`<li>${renderInlineMarkdown((unordered || ordered)[1])}</li>`);
    } else if (quote) {
      closeParagraph();
      closeList();
      html.push(`<blockquote>${renderInlineMarkdown(quote[1])}</blockquote>`);
    } else {
      closeList();
      paragraph.push(trimmed);
    }
  }
  closeParagraph();
  closeList();
  if (codeLines) html.push(renderCodeBlock(codeLines, codeLanguage));
  return html.join('');
}

function currentModel() {
  return MODEL_DEFINITIONS[selectedModelKey];
}

function aiConfigLabel() {
  const model = currentModel();
  const reasoning = model.supportsReasoning === false
    ? 'direct answers'
    : selectedModelKey === 'liquid'
    ? (reasoningEnabled ? `${effortOptions[effortIndex].textContent} reasoning shown` : 'built-in reasoning hidden')
    : (reasoningEnabled ? `${effortOptions[effortIndex].textContent} reasoning` : 'reasoning off');
  const contextSize = model.runtime === 'transformers' ? '32K' : '8K';
  return `${reasoning} · ${generationBudgets[budgetIndex] / 1024}K generation · ${contextSize} context`;
}

function updateAiConfigDisplay() {
  document.querySelectorAll('[data-ai-config]').forEach((node) => { node.textContent = aiConfigLabel(); });
}

function aiMarkup() {
  const model = currentModel();
  const ready = localAiState === 'ready';
  const loading = localAiState === 'loading';
  const gpuAvailable = Boolean(navigator.gpu);
  const status = ready ? 'ready · local & private' : loading ? `loading · ${Math.round(localAiProgress * 100)}%` : gpuAvailable ? 'ready to load' : 'WebGPU unavailable';
  const progressLabel = ready ? 'cached locally' : loading ? `${Math.round(localAiProgress * 100)}% of ${model.size}` : `${model.size} first load`;
  const cells = Array.from({ length: 32 }, (_, index) => `<i class="ai-heat-cell${index < Math.round(localAiProgress * 32) ? ' loaded' : ''}" style="--i:${index}" aria-hidden="true"></i>`).join('');
  return `<div class="ai-card" data-model-card="${model.key}"><div class="ai-card-main"><div class="ai-card-head"><h3>run a LLM in the browser <span>${model.name} · ${model.badge}</span></h3><span class="ai-status" data-ai-status>${status}</span></div><p class="ai-copy">Runs ${model.shortName} in your browser. First load: ${model.size}, then cached locally.</p><div class="ai-heat${loading ? ' loading' : ''}" data-ai-heat role="progressbar" aria-label="Local model loading progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(localAiProgress * 100)}">${cells}</div><div class="ai-card-foot"><span data-ai-config>${aiConfigLabel()}</span><span data-ai-progress>${progressLabel}</span></div></div><button type="button" data-ai-load${ready || loading || !gpuAvailable ? ' disabled' : ''}>${ready ? 'model ready' : loading ? 'loading…' : gpuAvailable ? 'load model' : 'WebGPU required'}</button></div>`;
}

function modelSelectorMarkup() {
  const choices = Object.values(MODEL_DEFINITIONS).map((model, index) => {
    const selected = model.key === selectedModelKey;
    const disabled = localAiState === 'loading';
    return `<button type="button" class="model-choice${selected ? ' selected highlighted' : ''}" data-model-key="${model.key}" aria-current="${selected}" aria-label="Select ${model.shortName} and load it locally" tabindex="${selected ? '0' : '-1'}"${disabled ? ' disabled' : ''}><span class="model-cursor">${selected ? '›' : ''}</span><span class="model-index">${index + 1}.</span><strong>${model.name}</strong><span class="model-selected ${model.key}">${model.positioning}${selected ? ' · selected ✓' : ''}</span><small>${model.detail} · runs in this browser</small></button>`;
  }).join('');
  return `<div class="model-panel"><div class="model-heading"><h3>Select model</h3><p>Selecting a model starts its local WebGPU load immediately.</p></div>${choices}<p class="model-note"><span>●</span> two private browser models · arrow keys move · Enter selects</p></div>`;
}

function canonical(raw) {
  const cleaned = raw.trim().replace(/\s+/g, ' ').toLowerCase();
  return commandAliases.get(cleaned) || cleaned;
}

function commandMarkup(key) {
  const resumeCommand = commandRegistry.get(key);
  if (resumeCommand) return renderCommand(resumeCommand, resumeConfig);
  if (key === '/model') return modelSelectorMarkup();
  if (key === '/ai') return aiMarkup();
  if (key === '/help') return `<div class="help-grid">${commandHelp.map(([command, description]) => `<button data-run="${command}"><span class="help-command">${command}</span><span class="help-description">${description}</span></button>`).join('')}</div>`;
  return `<p><span class="error">command not found:</span> ${escapeHtml(key || '(empty)')}<br><span class="meta">Type /help to list available commands.</span></p>`;
}

function run(rawCommand) {
  const raw = rawCommand.trim();
  if (!raw) return;
  const key = canonical(raw);
  if (key === '/effort') {
    openEffort();
  } else if (key === '/clear') {
    output.replaceChildren();
  } else {
    output.querySelector('.empty-state')?.remove();
    output.insertAdjacentHTML('beforeend', `<section class="output-block"><div class="output-title"><span>&gt;</span> ${escapeHtml(raw)}</div><div class="output-body">${commandMarkup(key)}</div></section>`);
    const commandPanel = output.lastElementChild;
    commandRegistry.get(key)?.onRender?.({ panel: commandPanel, run, input });
    revealCommandPanel(commandPanel);
    if (key === '/help' || key === '/model') {
      requestAnimationFrame(() => {
        const preferredChoice = commandPanel.querySelector('[aria-current="true"]:not(:disabled)')
          || commandPanel.querySelector('button:not(:disabled)');
        preferredChoice?.focus({ preventScroll: true });
        if (preferredChoice?.matches('[data-model-key]')) highlightModelChoice(preferredChoice);
      });
    }
  }
  history = [...history.filter((item) => item !== raw), raw];
  historyIndex = -1;
  input.value = '';
}

function revealCommandPanel(panel) {
  if (!panel) return;
  requestAnimationFrame(() => {
    const rect = panel.getBoundingClientRect();
    const topEdge = 12;
    const promptTop = Math.min(getVisibleViewportBottom(), form.getBoundingClientRect().top);
    const bottomEdge = Math.max(topEdge + 180, promptTop - 12);
    const availableHeight = bottomEdge - topEdge;
    let offset = 0;
    if (rect.height > availableHeight) offset = rect.top - topEdge;
    else if (rect.bottom > bottomEdge) offset = rect.bottom - bottomEdge;
    else if (rect.top < topEdge) offset = rect.top - topEdge;
    if (Math.abs(offset) > 1) window.scrollBy({ top: offset, behavior: 'smooth' });
  });
}

function renderEffort() {
  effortPanel.style.setProperty('--effort-index', draftEffortIndex);
  effortPanel.classList.toggle('reasoning-off', !draftReasoningEnabled);
  reasoningToggle.textContent = draftReasoningEnabled ? 'on' : 'off';
  reasoningToggle.setAttribute('aria-pressed', String(draftReasoningEnabled));
  effortOptions.forEach((option, index) => {
    const selected = index === draftEffortIndex;
    option.classList.toggle('selected', selected);
    option.setAttribute('aria-checked', String(selected));
    option.tabIndex = selected ? 0 : -1;
  });
  budgetOptions.forEach((option, index) => {
    const selected = index === draftBudgetIndex;
    option.classList.toggle('selected', selected);
    option.setAttribute('aria-checked', String(selected));
  });
}

function openEffort() {
  draftEffortIndex = effortIndex;
  draftReasoningEnabled = reasoningEnabled;
  draftBudgetIndex = budgetIndex;
  renderEffort();
  form.hidden = true;
  effortPanel.hidden = false;
  effortPanel.focus({ preventScroll: true });
  requestAnimationFrame(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  });
}

function closeEffort(confirm) {
  if (confirm) {
    effortIndex = draftEffortIndex;
    reasoningEnabled = draftReasoningEnabled;
    budgetIndex = draftBudgetIndex;
    localStorage.setItem('resume-reasoning-effort', String(effortIndex));
    localStorage.setItem('resume-reasoning-enabled-v2', String(reasoningEnabled));
    localStorage.setItem('resume-generation-budget', String(budgetIndex));
    updateEffortTrigger();
    updateAiConfigDisplay();
  }
  effortPanel.hidden = true;
  form.hidden = false;
  input.focus();
}

function cycleMode() {
  modeIndex = (modeIndex + 1) % modes.length;
  const mode = modes[modeIndex];
  modeIndicator.className = `mode-status ${mode.className}`;
  modeIndicator.querySelector('.mode-label').textContent = mode.label;
}

function highlightModelChoice(button) {
  const panel = button?.closest('.model-panel');
  if (!panel) return;
  panel.querySelectorAll('[data-model-key]').forEach((choice) => {
    const highlighted = choice === button;
    choice.classList.toggle('highlighted', highlighted);
    choice.tabIndex = highlighted ? 0 : -1;
    choice.querySelector('.model-cursor').textContent = highlighted ? '›' : '';
  });
}

function refreshModelSelectors() {
  document.querySelectorAll('.model-panel').forEach((panel) => {
    const highlightedChoice = panel.querySelector('.model-choice.highlighted')
      || panel.querySelector(`[data-model-key="${selectedModelKey}"]`);
    panel.querySelectorAll('[data-model-key]').forEach((button) => {
      const selected = button.dataset.modelKey === selectedModelKey;
      const highlighted = button === highlightedChoice;
      button.classList.toggle('selected', selected);
      button.classList.toggle('highlighted', highlighted);
      button.setAttribute('aria-current', String(selected));
      button.tabIndex = highlighted ? 0 : -1;
      button.disabled = localAiState === 'loading';
      button.querySelector('.model-cursor').textContent = highlighted ? '›' : '';
      const model = MODEL_DEFINITIONS[button.dataset.modelKey];
      button.querySelector('.model-selected').textContent = `${model.positioning}${selected ? ' · selected ✓' : ''}`;
    });
  });
}

function refreshAiCards() {
  document.querySelectorAll('.ai-card').forEach((card) => {
    card.outerHTML = aiMarkup();
  });
}

function selectModel(modelKey) {
  if (!MODEL_DEFINITIONS[modelKey] || localAiState === 'loading' || localAiBusy) return false;
  selectedModelKey = modelKey;
  localStorage.setItem('resume-local-model', selectedModelKey);
  const alreadyLoaded = loadedModelKey === selectedModelKey && localAiEngine;
  localAiState = alreadyLoaded ? 'ready' : 'idle';
  localAiProgress = alreadyLoaded ? 1 : 0;
  localAiActive = Boolean(alreadyLoaded);
  updateAiConfigDisplay();
  refreshModelSelectors();
  refreshAiCards();
  return true;
}

function updateLocalAiStatus(message) {
  document.querySelectorAll('[data-ai-status]').forEach((status) => { status.textContent = message; });
}

function updateLocalAiProgress(progress, phase = 'loading') {
  localAiProgress = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : localAiProgress));
  const percent = Math.round(localAiProgress * 100);
  document.querySelectorAll('[data-ai-heat]').forEach((heat) => {
    heat.classList.toggle('loading', phase === 'loading');
    heat.setAttribute('aria-valuenow', String(percent));
    const cells = [...heat.querySelectorAll('.ai-heat-cell')];
    cells.forEach((cell, index) => cell.classList.toggle('loaded', index < Math.round(localAiProgress * cells.length)));
  });
  const label = phase === 'ready' ? 'cached locally' : phase === 'error' ? 'load interrupted' : `${percent}% of ${currentModel().size}`;
  document.querySelectorAll('[data-ai-progress]').forEach((node) => { node.textContent = label; });
}

function updateLocalAiButtons(label, disabled = true) {
  document.querySelectorAll('[data-ai-load]').forEach((button) => {
    button.textContent = label;
    button.disabled = disabled;
  });
}

function addChatMessage(label, text = '') {
  const section = document.createElement('section');
  const isUser = label === 'you';
  section.className = `output-block ai-message ${isUser ? 'user-message' : 'assistant-message'}`;
  const body = document.createElement('div');
  body.className = 'output-body';
  const content = document.createElement('div');
  content.className = 'ai-message-content';
  content.setAttribute('aria-live', isUser ? 'off' : 'polite');
  content.textContent = text;
  body.append(content);
  section.append(body);
  output.append(section);
  requestAnimationFrame(() => section.scrollIntoView({ behavior: 'smooth', block: 'end' }));
  return content;
}

let followReplyFrame = 0;

function focusReply(content, initial = false) {
  const section = content.closest('.output-block');
  if (!section) return;
  if (initial) {
    requestAnimationFrame(() => section.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    return;
  }
  if (followReplyFrame) return;
  followReplyFrame = requestAnimationFrame(() => {
    followReplyFrame = 0;
    const sectionBottom = section.getBoundingClientRect().bottom;
    const promptTop = form.getBoundingClientRect().top;
    const visibleBottom = Math.min(getVisibleViewportBottom(12), promptTop - 12);
    if (sectionBottom > visibleBottom) window.scrollBy({ top: sectionBottom - visibleBottom, behavior: 'auto' });
  });
}

function extractReasoningText(value, assumeOpen = false) {
  const start = value.indexOf('<think>');
  const taggedEnd = value.indexOf('</think>');
  if (start < 0 && taggedEnd < 0) return assumeOpen ? value.trim() : '';
  const afterStart = start >= 0 ? value.slice(start + 7) : value;
  const end = afterStart.indexOf('</think>');
  return (end >= 0 ? afterStart.slice(0, end) : afterStart).trim();
}

function stripThinkBlocks(value) {
  let cleaned = value;
  let lowered = cleaned.toLowerCase();
  while (true) {
    const start = lowered.indexOf('<think>');
    if (start < 0) break;
    const end = lowered.indexOf('</think>', start + 7);
    if (end < 0) {
      cleaned = cleaned.slice(0, start);
      lowered = lowered.slice(0, start);
      break;
    }
    cleaned = cleaned.slice(0, start) + cleaned.slice(end + 8);
    lowered = cleaned.toLowerCase();
  }
  cleaned = cleaned.replace(/<\/think>/gi, '');
  const partialTags = ['</think', '</thin', '</thi', '</th', '</t', '</', '<think', '<thin', '<thi', '<th', '<t', '<'];
  const partial = partialTags.find((tag) => cleaned.toLowerCase().endsWith(tag));
  return partial ? cleaned.slice(0, -partial.length) : cleaned;
}

function estimateTokens(value) {
  return value ? Math.max(1, Math.round(value.length / 4)) : 0;
}

function ensureReasoningTrace(content, reasoningText) {
  let trace = content.querySelector('.reasoning-trace');
  if (!trace) {
    trace = document.createElement('details');
    trace.className = 'reasoning-trace';
    const summary = document.createElement('summary');
    const body = document.createElement('div');
    body.className = 'reasoning-trace-body';
    trace.append(summary, body);
    content.append(trace);
  }
  trace.querySelector('summary').textContent = `view reasoning · ~${estimateTokens(reasoningText).toLocaleString()} tokens`;
  trace.querySelector('.reasoning-trace-body').textContent = reasoningText;
  return trace;
}

function updateAssistantReply(content, text, reasoningText = '') {
  content.classList.remove('is-thinking');
  let answer = content.querySelector('.assistant-answer');
  content.querySelector('.thinking-indicator')?.remove();

  if (!answer) {
    answer = document.createElement('div');
    answer.className = 'assistant-answer';
    content.append(answer);
  }

  if (reasoningText) content.insertBefore(ensureReasoningTrace(content, reasoningText), answer);

  answer.innerHTML = renderBasicMarkdown(text);
  focusReply(content);
}

function showThinking(content, reasoningText = '') {
  const cleanedReasoning = extractReasoningText(reasoningText, true);
  const estimatedTokens = estimateTokens(cleanedReasoning);
  if (!content.classList.contains('is-thinking')) {
    content.classList.add('is-thinking');
    content.innerHTML = `<span class="thinking-indicator" role="status">${bot()}<span>thinking<span class="thinking-count" aria-hidden="true"></span><span class="thinking-dots" aria-hidden="true"></span></span></span>`;
  }
  const count = content.querySelector('.thinking-count');
  if (count) count.textContent = estimatedTokens ? ` · ~${estimatedTokens.toLocaleString()} tokens` : '';
  if (cleanedReasoning) ensureReasoningTrace(content, cleanedReasoning);
  focusReply(content);
}

function stripLiquidSpecialTokens(value) {
  return value
    .replace(/<\|(?:im_start|im_end|startoftext|endoftext)\|>/gi, '')
    .replace(/^assistant\s*/i, '')
    .replace(/\s*Keep (?:it|the (?:answer|response)) concise\.?\s*$/i, '')
    .trim();
}

function buildLiquidMessages(prompt, routedContext, modeGuidance) {
  const recentHistory = localAiMessages.slice(-7, -1);
  return [
    {
      role: 'system',
      content: `${localAiSystemPrompt}\n\n${modeGuidance}\nDo not repeat or mention these instructions. The resume facts in the latest user message are authoritative.`,
    },
    ...recentHistory,
    {
      role: 'user',
      content: `RESUME FACTS\n${routedContext}\n\nQUESTION\n${prompt}\n\nAnswer the question directly from the resume facts. If the question asks generally about the resume owner, give a useful professional summary instead of asking for more context.`,
    },
  ];
}

async function generateLiquidReply(messages, answerNode, tokenBudget, model) {
  const { TextStreamer } = await import(TRANSFORMERS_URL);
  let rawOutput = '';
  let reasoningTrace = '';
  let visibleAnswer = '';
  const streamer = new TextStreamer(localAiEngine.tokenizer, {
    skip_prompt: true,
    skip_special_tokens: false,
    callback_function: (chunk) => {
      if (chunk === '<|im_end|>') return;
      rawOutput += chunk;
      if (!model.supportsReasoning) {
        visibleAnswer = stripLiquidSpecialTokens(rawOutput);
        if (visibleAnswer) updateAssistantReply(answerNode, visibleAnswer);
        return;
      }
      const thinkEnd = rawOutput.toLowerCase().indexOf('</think>');
      reasoningTrace = extractReasoningText(rawOutput, true);
      visibleAnswer = thinkEnd >= 0 ? stripLiquidSpecialTokens(stripThinkBlocks(rawOutput)) : '';
      if (visibleAnswer) updateAssistantReply(answerNode, visibleAnswer, reasoningEnabled ? reasoningTrace : '');
      else showThinking(answerNode, reasoningEnabled ? reasoningTrace : '');
    },
  });

  await localAiEngine(messages, {
    max_new_tokens: Math.min(tokenBudget, model.maxGenerationTokens || tokenBudget),
    streamer,
    do_sample: false,
    ...(model.generationOptions || {}),
  });

  const answer = stripLiquidSpecialTokens(stripThinkBlocks(rawOutput));
  return { answer, reasoning: model.supportsReasoning && reasoningEnabled ? extractReasoningText(rawOutput, true) : '' };
}

async function disposeLocalAi() {
  const engine = localAiEngine;
  localAiEngine = null;
  localAiActive = false;
  try {
    if (loadedModelKey === 'qwen') await engine?.unload?.();
    else await engine?.dispose?.();
  } catch (error) {
    console.warn('Unable to release previous local model cleanly.', error);
  }
  localAiWorker?.terminate();
  localAiWorker = null;
  loadedModelKey = null;
}

async function loadQwenModel(model) {
  const webllm = await import(WEBLLM_URL);
  const workerSource = `import { WebWorkerMLCEngineHandler } from '${WEBLLM_URL}'; const handler = new WebWorkerMLCEngineHandler(); self.onmessage = (message) => handler.onmessage(message);`;
  const workerUrl = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
  localAiWorker = new Worker(workerUrl, { type: 'module', name: 'resume-local-ai-qwen' });
  URL.revokeObjectURL(workerUrl);
  const appConfig = {
    cacheBackend: 'cache',
    model_list: [{
      model: model.modelUrl,
      model_id: model.modelId,
      model_lib: model.modelLibUrl,
      overrides: { context_window_size: 8192 },
    }],
  };
  return webllm.CreateWebWorkerMLCEngine(localAiWorker, model.modelId, {
    appConfig,
    initProgressCallback: (report) => {
      const progress = Number(report.progress);
      updateLocalAiProgress(progress);
      updateLocalAiStatus(Number.isFinite(progress) ? `loading · ${Math.round(progress * 100)}%` : 'loading…');
    },
    logLevel: 'WARN',
  });
}

async function loadLiquidModel(model) {
  const transformers = await import(TRANSFORMERS_URL);
  // Keep the strict CSP: Transformers.js otherwise imports its cached WASM
  // bootstrap through a blob: URL, which would require allowing blob scripts.
  transformers.env.useWasmCache = false;
  transformers.env.backends.onnx.wasm.wasmPaths = {
    mjs: ONNX_WEBGPU_FACTORY_URL,
    wasm: ONNX_WEBGPU_WASM_URL,
  };
  const generator = await transformers.pipeline('text-generation', model.modelId, {
    dtype: 'q4',
    device: 'webgpu',
    progress_callback: (report) => {
      if (report.status !== 'progress' || !report.file?.endsWith('.onnx_data')) return;
      const rawProgress = Number(report.progress);
      const progress = rawProgress > 1 ? rawProgress / 100 : rawProgress;
      updateLocalAiProgress(progress);
      updateLocalAiStatus(Number.isFinite(progress) ? `loading · ${Math.round(progress * 100)}%` : 'loading…');
    },
  });
  return generator;
}

async function loadLocalAi(modelKey = selectedModelKey) {
  if (!MODEL_DEFINITIONS[modelKey]) return;
  if (localAiState === 'loading') return;
  if (localAiState === 'ready' && loadedModelKey === modelKey && localAiEngine) {
    localAiActive = true;
    input.placeholder = `ask ${currentModel().shortName} · slash commands still work`;
    return;
  }
  if (!navigator.gpu) {
    localAiState = 'error';
    updateLocalAiStatus('WebGPU unavailable');
    updateLocalAiProgress(0, 'error');
    updateLocalAiButtons('WebGPU unavailable', true);
    return;
  }

  selectedModelKey = modelKey;
  localStorage.setItem('resume-local-model', selectedModelKey);
  if (localAiEngine || localAiWorker) await disposeLocalAi();
  localAiState = 'loading';
  localAiProgress = 0;
  updateLocalAiButtons('loading…', true);
  updateLocalAiStatus('initializing…');
  updateLocalAiProgress(0);
  refreshModelSelectors();

  try {
    const model = currentModel();
    localAiEngine = model.runtime === 'webllm' ? await loadQwenModel(model) : await loadLiquidModel(model);
    loadedModelKey = model.key;
    localAiState = 'ready';
    localAiActive = true;
    updateLocalAiProgress(1, 'ready');
    updateLocalAiStatus('ready · local & private');
    updateLocalAiButtons('model ready', true);
    refreshModelSelectors();
    input.placeholder = `ask ${model.shortName} · slash commands still work`;
    addChatMessage('local-ai', model.readyMessage);
  } catch (error) {
    console.error(error);
    localAiState = 'error';
    localAiWorker?.terminate();
    localAiWorker = null;
    localAiEngine = null;
    loadedModelKey = null;
    updateLocalAiProgress(localAiProgress, 'error');
    updateLocalAiStatus('load failed');
    updateLocalAiButtons('retry', false);
    refreshModelSelectors();
  }
}

async function askLocalAi(prompt) {
  if (!localAiEngine || localAiState !== 'ready' || localAiBusy) return;
  localAiBusy = true;
  input.value = '';
  input.disabled = true;
  addChatMessage('you', prompt);
  const answerNode = addChatMessage('local-ai');
  showThinking(answerNode);
  focusReply(answerNode, true);
  localAiMessages.push({ role: 'user', content: prompt });

  try {
    const activeModel = MODEL_DEFINITIONS[loadedModelKey] || currentModel();
    const modeGuidance = reasoningEnabled && activeModel.supportsReasoning !== false
      ? reasoningGuidance[effortIndex]
      : 'Answer directly without a private reasoning pass.';
    const routedContext = getLocalAiContext(localAiMessages);
    const messages = [{ role: 'system', content: `${localAiSystemPrompt}\n\n${routedContext}\n\n${modeGuidance}` }, ...localAiMessages.slice(-8)];
    const tokenBudget = generationBudgets[budgetIndex];

    if (activeModel.runtime === 'transformers') {
      const liquidMessages = buildLiquidMessages(prompt, routedContext, modeGuidance);
      const result = await generateLiquidReply(liquidMessages, answerNode, tokenBudget, activeModel);
      updateAssistantReply(answerNode, result.answer || 'No final answer was generated before the local token limit.', result.reasoning);
      localAiMessages.push({ role: 'assistant', content: result.answer });
      return;
    }

    const completedParts = [];
    let reasoningTrace = '';
    let explicitReasoningTrace = '';
    let requestMessages = messages;
    let finishReason = '';

    for (let pass = 0; pass < 2; pass += 1) {
      const thinkingThisPass = pass === 0 && reasoningEnabled;
      const chunks = await localAiEngine.chat.completions.create({
        messages: requestMessages,
        temperature: thinkingThisPass ? 0.6 : 0.5,
        top_p: thinkingThisPass ? 0.95 : 0.8,
        repetition_penalty: 1.1,
        max_tokens: pass === 0 ? tokenBudget : 768,
        stream: true,
        extra_body: { enable_thinking: thinkingThisPass },
      });
      let passAnswer = '';
      finishReason = '';
      for await (const chunk of chunks) {
        const choice = chunk.choices[0];
        if (thinkingThisPass) explicitReasoningTrace += choice?.delta?.reasoning_content || '';
        passAnswer += choice?.delta?.content || '';
        finishReason = choice?.finish_reason || finishReason;
        const thinkEnd = passAnswer.toLowerCase().indexOf('</think>');
        if (thinkingThisPass) reasoningTrace = explicitReasoningTrace || extractReasoningText(passAnswer, true);
        const visiblePass = thinkingThisPass
          ? (explicitReasoningTrace || thinkEnd >= 0 ? stripThinkBlocks(passAnswer).trimStart() : '')
          : stripThinkBlocks(passAnswer);
        const visibleAnswer = [...completedParts, visiblePass].filter(Boolean).join('\n\n');
        if (visibleAnswer) updateAssistantReply(answerNode, visibleAnswer, reasoningTrace);
        else showThinking(answerNode, thinkingThisPass ? passAnswer : '');
      }
      const thinkEnd = passAnswer.toLowerCase().indexOf('</think>');
      const cleanPart = thinkingThisPass && !explicitReasoningTrace && thinkEnd < 0 && finishReason === 'length'
        ? ''
        : stripThinkBlocks(passAnswer).trim();
      if (cleanPart) completedParts.push(cleanPart);
      if (finishReason !== 'length') break;
      requestMessages = completedParts.length
        ? [
            ...messages,
            { role: 'assistant', content: completedParts.join('\n\n') },
            { role: 'user', content: 'Continue from the exact cutoff. Complete the unfinished sentence without repeating the previous answer.' },
          ]
        : [
            ...messages,
            { role: 'user', content: 'The private reasoning allowance ended. Answer the original question directly now without additional reasoning.' },
          ];
    }
    const finalAnswer = completedParts.join('\n\n').trim();
    const displayedAnswer = finishReason === 'length'
      ? `${finalAnswer}\n\n_Response paused after reaching the local generation limit._`
      : finalAnswer;
    updateAssistantReply(answerNode, displayedAnswer || 'No response generated.', reasoningTrace);
    localAiMessages.push({ role: 'assistant', content: finalAnswer });
  } catch (error) {
    console.error(error);
    answerNode.textContent = `Local generation failed: ${error instanceof Error ? error.message : 'unknown error'}`;
  } finally {
    localAiBusy = false;
    input.disabled = false;
    requestAnimationFrame(() => {
      if (!effortPanel.hidden) return;
      input.focus();
      const caret = input.value.length;
      input.setSelectionRange(caret, caret);
    });
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = input.value.trim();
  if (localAiActive && value && !value.startsWith('/')) askLocalAi(value);
  else run(value);
});
document.addEventListener('click', (event) => {
  const codeDownloadButton = event.target.closest('[data-code-download]');
  if (codeDownloadButton) {
    event.preventDefault();
    downloadCodeBlock(codeDownloadButton);
    return;
  }
  const modelLoadButton = event.target.closest('[data-model-key]');
  if (modelLoadButton) highlightModelChoice(modelLoadButton);
  if (modelLoadButton && selectModel(modelLoadButton.dataset.modelKey)) {
    run('/ai');
    loadLocalAi(modelLoadButton.dataset.modelKey);
    return;
  }
  const runButton = event.target.closest('[data-run]');
  if (runButton) run(runButton.dataset.run);
  const aiButton = event.target.closest('[data-ai-load]');
  if (aiButton) loadLocalAi();
});
terminalShell.addEventListener('click', (event) => {
  if (!effortPanel.hidden || input.disabled) return;
  if (event.target.closest('a, button, input, summary, [contenteditable="true"]')) return;
  if (window.getSelection()?.toString()) return;
  input.focus({ preventScroll: true });
  input.setSelectionRange(input.value.length, input.value.length);
});
effortTrigger.addEventListener('click', openEffort);
effortOptions.forEach((option, index) => option.addEventListener('click', () => {
  draftEffortIndex = index;
  renderEffort();
}));
reasoningToggle.addEventListener('click', () => {
  draftReasoningEnabled = !draftReasoningEnabled;
  renderEffort();
});
budgetOptions.forEach((option, index) => option.addEventListener('click', () => {
  draftBudgetIndex = index;
  renderEffort();
}));
effortApply.addEventListener('click', () => closeEffort(true));
document.addEventListener('keydown', (event) => {
  if (!effortPanel.hidden) {
    if (event.target.closest('button') && (event.key === 'Enter' || event.key === ' ')) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const step = event.key === 'ArrowRight' ? 1 : -1;
      draftEffortIndex = Math.max(0, Math.min(effortOptions.length - 1, draftEffortIndex + step));
      renderEffort();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      closeEffort(true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeEffort(false);
    }
    return;
  }
  if (event.key === 'Tab' && event.shiftKey) {
    event.preventDefault();
    cycleMode();
    return;
  }
  const panelChoice = event.target.closest?.('.help-grid button, .model-panel button');
  if (panelChoice && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
    event.preventDefault();
    const choices = [...panelChoice.closest('.help-grid, .model-panel').querySelectorAll('button:not(:disabled)')];
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = (choices.indexOf(panelChoice) + direction + choices.length) % choices.length;
    choices[nextIndex].focus({ preventScroll: true });
    if (choices[nextIndex].matches('[data-model-key]')) highlightModelChoice(choices[nextIndex]);
    choices[nextIndex].scrollIntoView({ block: 'nearest' });
    return;
  }
  if (panelChoice && event.key === 'Enter') {
    event.preventDefault();
    panelChoice.click();
  }
});
input.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowUp') { event.preventDefault(); if (!history.length) return; historyIndex = Math.min(historyIndex + 1, history.length - 1); input.value = history[history.length - 1 - historyIndex] || ''; }
  if (event.key === 'ArrowDown') { event.preventDefault(); historyIndex = Math.max(historyIndex - 1, -1); input.value = historyIndex === -1 ? '' : history[history.length - 1 - historyIndex] || ''; }
  if (event.key === 'Tab' && !event.shiftKey) { const match = commands.find((command) => command.startsWith(input.value.toLowerCase())); if (match) { event.preventDefault(); input.value = match; } }
});

window.visualViewport?.addEventListener('resize', syncKeyboardInset, { passive: true });
window.visualViewport?.addEventListener('scroll', syncKeyboardInset, { passive: true });
input.addEventListener('focus', () => {
  requestAnimationFrame(() => {
    syncKeyboardInset();
    form.scrollIntoView({ block: 'nearest' });
  });
});
input.addEventListener('blur', () => {
  document.documentElement.style.setProperty('--keyboard-inset', '0px');
});

if (!window.matchMedia('(hover: none) and (pointer: coarse)').matches) input.focus();
