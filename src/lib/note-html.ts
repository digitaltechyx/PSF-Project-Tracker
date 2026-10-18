/** Lightweight HTML helpers for Keep-style note bodies. */

const ALLOWED_TAGS = new Set([
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'strike',
  'del',
  'mark',
  'ul',
  'ol',
  'li',
  'br',
  'div',
  'p',
  'span',
]);

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** True when stored body already contains rich-text markup. */
export function looksLikeNoteHtml(value?: string | null): boolean {
  if (!value) return false;
  return /<\/?(b|strong|i|em|u|s|strike|del|mark|ul|ol|li|br|div|p|span)\b/i.test(value);
}

/** Convert legacy plain-text notes into simple HTML paragraphs. */
export function plainTextToNoteHtml(text: string): string {
  if (!text) return '';
  if (looksLikeNoteHtml(text)) return text;
  return escapeHtml(text).replace(/\n/g, '<br>');
}

/** Strip tags for empty checks / search. */
export function noteHtmlToPlainText(html?: string | null): string {
  if (!html) return '';
  if (typeof document === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const el = document.createElement('div');
  el.innerHTML = html;
  return (el.textContent || '').replace(/\u00a0/g, ' ').trim();
}

export function noteBodyHasContent(body?: string | null): boolean {
  return noteHtmlToPlainText(body).length > 0;
}

/**
 * Allow only formatting tags used by the note editor.
 * Removes scripts/events and unsafe attributes.
 */
export function sanitizeNoteHtml(dirty?: string | null): string {
  if (!dirty) return '';
  if (typeof document === 'undefined') {
    return dirty.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  }

  const root = document.createElement('div');
  root.innerHTML = dirty;

  const walk = (node: Node) => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        const tag = el.tagName.toLowerCase();
        if (!ALLOWED_TAGS.has(tag)) {
          // Keep text content, drop the wrapper
          while (el.firstChild) {
            node.insertBefore(el.firstChild, el);
          }
          node.removeChild(el);
          continue;
        }

        // Strip all attributes except safe highlight styling on mark/span
        const keepStyle =
          (tag === 'mark' || tag === 'span') &&
          /background(-color)?\s*:/i.test(el.getAttribute('style') || '');
        const style = keepStyle ? el.getAttribute('style') : null;
        for (const attr of Array.from(el.attributes)) {
          el.removeAttribute(attr.name);
        }
        if (style) {
          // Only keep background-color
          const match = style.match(/background(?:-color)?\s*:\s*([^;]+)/i);
          if (match) {
            el.setAttribute('style', `background-color: ${match[1].trim()}`);
          }
        }
        if (tag === 'mark' && !el.getAttribute('style')) {
          el.setAttribute('style', 'background-color: #fff59d');
        }

        walk(el);
      } else if (child.nodeType === Node.COMMENT_NODE) {
        node.removeChild(child);
      }
    }
  };

  walk(root);
  return root.innerHTML;
}
