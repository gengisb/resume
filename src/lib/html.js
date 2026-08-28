export function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character]);
}

export function safeHref(value) {
  try {
    const url = new URL(value, window.location.href);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? escapeHtml(value) : '#';
  } catch {
    return '#';
  }
}

export function bot(mini = true) {
  return `<span class="pixel-bot${mini ? ' mini' : ''}" aria-hidden="true"><span class="pixel-ear left"></span><span class="pixel-ear right"></span><span class="pixel-eye left"></span><span class="pixel-eye right"></span><span class="pixel-feet"><i></i><i></i><i></i><i></i></span></span>`;
}
