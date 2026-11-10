"use client";

import React, { useEffect, useRef } from 'react';
import {
  Bold,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Strikethrough,
  Underline,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  noteBodyHasContent,
  normalizeNoteHtml,
  plainTextToNoteHtml,
  sanitizeNoteHtml,
} from '@/lib/note-html';

const HIGHLIGHT = '#fff59d';

type FormatCmd =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikeThrough'
  | 'insertUnorderedList'
  | 'insertOrderedList'
  | 'highlight';

function ToolbarButton({
  title,
  active,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={title}
      className={cn(
        'h-8 w-8 text-slate-700',
        active && 'bg-slate-900/10 text-slate-900'
      )}
      onMouseDown={(e) => {
        // Keep selection in the editor
        e.preventDefault();
      }}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function insertHtmlAtSelection(html: string) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) {
    document.execCommand('insertHTML', false, html);
    return;
  }
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const temp = document.createElement('div');
  temp.innerHTML = html;
  const frag = document.createDocumentFragment();
  let node: ChildNode | null;
  let lastNode: ChildNode | null = null;
  while ((node = temp.firstChild)) {
    lastNode = frag.appendChild(node);
  }
  range.insertNode(frag);
  if (lastNode) {
    range.setStartAfter(lastNode);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

export function NoteRichEditor({
  value,
  onChange,
  placeholder = 'Take a note…',
  disabled,
  className,
  minHeightClass = 'min-h-[80px]',
  maxHeightClass = 'max-h-[320px]',
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minHeightClass?: string;
  /** Keep-style scrollable body so notes don’t grow forever. */
  maxHeightClass?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef('');
  const [, bump] = React.useState(0);

  // Sync external value into the editor when it changes from outside typing
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const next = sanitizeNoteHtml(plainTextToNoteHtml(value || ''));
    const nextNorm = normalizeNoteHtml(next);
    if (nextNorm === normalizeNoteHtml(lastEmitted.current)) return;
    if (normalizeNoteHtml(el.innerHTML) === nextNorm) {
      lastEmitted.current = next;
      return;
    }
    // Don't clobber while the user is actively typing in this field
    if (!disabled && document.activeElement === el) return;
    el.innerHTML = next || '';
    lastEmitted.current = next;
  }, [value, disabled]);

  const emit = (opts?: { scrubDom?: boolean }) => {
    const el = editorRef.current;
    if (!el) return;
    let html = sanitizeNoteHtml(el.innerHTML);
    if (!noteBodyHasContent(html)) html = '';
    // Only rewrite DOM on blur/paste scrub — never while typing (caret jump).
    if (
      opts?.scrubDom &&
      normalizeNoteHtml(el.innerHTML) !== normalizeNoteHtml(html)
    ) {
      el.innerHTML = html || '';
    }
    lastEmitted.current = html;
    onChange(html);
    bump((n) => n + 1);
  };

  const run = (cmd: FormatCmd) => {
    const el = editorRef.current;
    if (!el || disabled) return;
    el.focus();
    try {
      document.execCommand('styleWithCSS', false, 'true');
    } catch {
      /* ignore */
    }

    if (cmd === 'highlight') {
      const already = document.queryCommandValue('hiliteColor');
      const normalized = String(already || '').toLowerCase();
      const isOn =
        normalized.includes('fff59d') ||
        normalized.includes('255, 245, 157') ||
        normalized === 'yellow';
      document.execCommand('hiliteColor', false, isOn ? 'transparent' : HIGHLIGHT);
      // Fallback for browsers that ignore hiliteColor
      if (!isOn) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount && sel.toString()) {
          const current = document.queryCommandValue('hiliteColor');
          if (!String(current || '').toLowerCase().includes('fff59d')) {
            const text = sel.toString();
            document.execCommand(
              'insertHTML',
              false,
              `<mark style="background-color:${HIGHLIGHT}">${text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')}</mark>`
            );
          }
        }
      }
    } else {
      document.execCommand(cmd, false);
    }
    emit();
  };

  const queryActive = (cmd: string) => {
    try {
      return document.queryCommandState(cmd);
    } catch {
      return false;
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    const clip = e.clipboardData;
    const html = clip.getData('text/html');
    const text = clip.getData('text/plain');

    let insert = '';
    if (html && html.trim()) {
      insert = sanitizeNoteHtml(html);
    }
    if (!noteBodyHasContent(insert) && text) {
      insert = plainTextToNoteHtml(text);
    }
    if (!insert) return;

    try {
      document.execCommand('styleWithCSS', false, 'true');
    } catch {
      /* ignore */
    }

    const ok = document.execCommand('insertHTML', false, insert);
    if (!ok) insertHtmlAtSelection(insert);
    emit({ scrubDom: true });
  };

  const handleCopy = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !editorRef.current) return;
    if (!editorRef.current.contains(sel.anchorNode)) return;

    // Prefer a sanitized HTML fragment so paste targets get clean formatting
    try {
      const range = sel.getRangeAt(0);
      const frag = range.cloneContents();
      const holder = document.createElement('div');
      holder.appendChild(frag);
      const html = sanitizeNoteHtml(holder.innerHTML);
      const plain = sel.toString();
      if (html || plain) {
        e.clipboardData.setData('text/html', html || plainTextToNoteHtml(plain));
        e.clipboardData.setData('text/plain', plain);
        e.preventDefault();
      }
    } catch {
      /* fall through to default copy */
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    const key = e.key.toLowerCase();
    if (key === 'b') {
      e.preventDefault();
      run('bold');
    } else if (key === 'i') {
      e.preventDefault();
      run('italic');
    } else if (key === 'u') {
      e.preventDefault();
      run('underline');
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      {!disabled && (
        <div className="flex flex-wrap items-center gap-0.5 rounded-xl border border-black/5 bg-white/50 p-1">
          <ToolbarButton title="Bold (Ctrl+B)" active={queryActive('bold')} onClick={() => run('bold')}>
            <Bold className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Italic (Ctrl+I)"
            active={queryActive('italic')}
            onClick={() => run('italic')}
          >
            <Italic className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Underline (Ctrl+U)"
            active={queryActive('underline')}
            onClick={() => run('underline')}
          >
            <Underline className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Strikethrough"
            active={queryActive('strikeThrough')}
            onClick={() => run('strikeThrough')}
          >
            <Strikethrough className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton title="Highlight" onClick={() => run('highlight')}>
            <Highlighter className="h-3.5 w-3.5" />
          </ToolbarButton>
          <div className="mx-1 h-5 w-px bg-slate-300/80" />
          <ToolbarButton
            title="Bullets"
            active={queryActive('insertUnorderedList')}
            onClick={() => run('insertUnorderedList')}
          >
            <List className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Numbered list"
            active={queryActive('insertOrderedList')}
            onClick={() => run('insertOrderedList')}
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </ToolbarButton>
        </div>
      )}

      <div
        ref={editorRef}
        role="textbox"
        aria-multiline
        contentEditable={!disabled}
        suppressContentEditableWarning
        data-placeholder={placeholder}
        className={cn(
          'note-rich-editor w-full overflow-y-auto bg-transparent px-0 text-sm leading-6 text-slate-800 outline-none',
          minHeightClass,
          maxHeightClass,
          '[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5',
          '[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5',
          '[&_mark]:rounded-sm [&_mark]:px-0.5',
          '[&:empty]:before:pointer-events-none [&:empty]:before:text-muted-foreground [&:empty]:before:content-[attr(data-placeholder)]',
          disabled && 'cursor-default opacity-80'
        )}
        onInput={() => emit()}
        onBlur={() => emit({ scrubDom: true })}
        onPaste={handlePaste}
        onCopy={handleCopy}
        onKeyDown={handleKeyDown}
        onKeyUp={() => bump((n) => n + 1)}
        onMouseUp={() => bump((n) => n + 1)}
      />
    </div>
  );
}

export function NoteHtmlPreview({
  html,
  className,
  clamp = false,
}: {
  html?: string | null;
  className?: string;
  /** Keep-style card clamp with bottom fade. */
  clamp?: boolean;
}) {
  const safe = sanitizeNoteHtml(plainTextToNoteHtml(html || ''));
  if (!safe) return null;
  return (
    <div className={cn(clamp && 'relative max-h-[240px] overflow-hidden')}>
      <div
        className={cn(
          'note-rich-preview whitespace-pre-wrap break-words text-sm leading-6 text-slate-800',
          '[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5',
          '[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5',
          '[&_mark]:rounded-sm [&_mark]:px-0.5',
          className
        )}
        dangerouslySetInnerHTML={{ __html: safe }}
      />
      {clamp && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/[0.06] to-transparent"
        />
      )}
    </div>
  );
}
