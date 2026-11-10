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

/** Tags to drop entirely (including their text). */
const DROP_TAGS = new Set(['script', 'style', 'meta', 'link', 'head', 'title', 'noscript']);

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
  return escapeHtml(text).replace(/\r\n|\r|\n/g, '<br>');
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

function normalizeHighlightStyle(style: string | null): string | null {
  if (!style) return null;
  const match = style.match(/background(?:-color)?\s*:\s*([^;]+)/i);
  if (!match) return null;
  const color = match[1].trim().toLowerCase();
  if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return null;
  return `background-color: ${match[1].trim()}`;
}

/**
 * Map common paste formatting (Word / Docs / browsers) onto allowed tags.
 * e.g. <span style="font-weight:bold"> → <strong>
 */
function promoteFormatting(el: HTMLElement): HTMLElement {
  const style = (el.getAttribute('style') || '').toLowerCase();
  const tag = el.tagName.toLowerCase();
  let wrapper: HTMLElement | null = null;

  const isBold =
    style.includes('font-weight:bold') ||
    style.includes('font-weight:700') ||
    style.includes('font-weight:600') ||
    el.getAttribute('face') === 'bold';
  const isItalic = style.includes('font-style:italic');
  const isUnderline =
    style.includes('text-decoration:underline') ||
    style.includes('text-decoration-line:underline');
  const isStrike =
    style.includes('line-through') ||
    style.includes('text-decoration:line-through');

  if (tag === 'span' || tag === 'font') {
    if (isBold) wrapper = document.createElement('strong');
    else if (isItalic) wrapper = document.createElement('em');
    else if (isUnderline) wrapper = document.createElement('u');
    else if (isStrike) wrapper = document.createElement('s');
  }

  const highlight = normalizeHighlightStyle(el.getAttribute('style'));
  if (!wrapper && highlight && (tag === 'span' || tag === 'font' || tag === 'mark')) {
    wrapper = document.createElement('mark');
    wrapper.setAttribute('style', highlight);
  }

  if (wrapper) {
    while (el.firstChild) wrapper.appendChild(el.firstChild);
    el.replaceWith(wrapper);
    return wrapper;
  }
  return el;
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
  // Some apps wrap paste in html/body — strip those shells first
  const cleaned = dirty
    .replace(/<\/?(html|body|head)[^>]*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  root.innerHTML = cleaned;

  const walk = (node: Node) => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        let el = child as HTMLElement;
        const tag = el.tagName.toLowerCase();

        if (DROP_TAGS.has(tag)) {
          node.removeChild(el);
          continue;
        }

        // Promote styled spans before deciding keep/unwrap
        el = promoteFormatting(el);
        const nextTag = el.tagName.toLowerCase();

        if (!ALLOWED_TAGS.has(nextTag)) {
          // Keep text content, drop the wrapper
          while (el.firstChild) {
            node.insertBefore(el.firstChild, el);
          }
          node.removeChild(el);
          continue;
        }

        // Strip all attributes except safe highlight styling on mark/span
        const keepStyle = normalizeHighlightStyle(el.getAttribute('style'));
        for (const attr of Array.from(el.attributes)) {
          el.removeAttribute(attr.name);
        }
        if ((nextTag === 'mark' || nextTag === 'span') && keepStyle) {
          el.setAttribute('style', keepStyle);
        }
        if (nextTag === 'mark' && !el.getAttribute('style')) {
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

/** Normalize HTML for equality checks (avoids cursor resets after paste/sanitize). */
export function normalizeNoteHtml(html?: string | null): string {
  return sanitizeNoteHtml(html || '')
    .replace(/\u00a0/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
}
