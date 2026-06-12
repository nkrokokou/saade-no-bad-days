// HTML/CSS sanitization helpers for print ticket templates and any place where
// DB-sourced strings are interpolated into raw HTML.

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]!));
}

// Strip anything that could break out of a <style> block or inject markup.
// Keeps the CSS itself but removes "<", ">" and "</style" sequences in any case.
export function sanitizeCss(value: unknown): string {
  if (!value) return '';
  return String(value)
    .replace(/<\/?\s*style[^>]*>/gi, '')
    .replace(/[<>]/g, '');
}
