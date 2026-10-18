"use client";

import React, { useEffect, useRef } from 'react';
import {
  Bold,
  Highlighter,
  Italic,
  List,
  Strikethrough,
  Underline,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { noteBodyHasContent, plainTextToNoteHtml, sanitizeNoteHtml } from '@/lib/note-html';

const HIGHLIGHT = '#fff59d';

type FormatCmd =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikeThrough'
  | 'insertUnorderedList'
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

export function NoteRichEditor({
  value,
  onChange,
  placeholder = 'Take a note…',
  disabled,
  className,
  minHeightClass = 'min-h-[80px]',
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minHeightClass?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef('');
  const [, bump] = React.useState(0);

  // Sync external value into the editor when it changes from outside typing
  useEffect(() => {
    const el = editorRef.current;
    if (!el || disabled) return;
    const next = sanitizeNoteHtml(plainTextToNoteHtml(value || ''));
    if (next === lastEmitted.current) return;
    if (el.innerHTML !== next) {
      el.innerHTML = next || '';
      lastEmitted.current = next;
    }
  }, [value, disabled]);

  const emit = () => {
    const el = editorRef.current;
    if (!el) return;
    let html = sanitizeNoteHtml(el.innerHTML);
    if (!noteBodyHasContent(html)) html = '';
    lastEmitted.current = html;
    onChange(html);
    bump((n) => n + 1);
  };

  const run = (cmd: FormatCmd) => {
    const el = editorRef.current;
    if (!el || disabled) return;
    el.focus();
    if (cmd === 'highlight') {
      const already = document.queryCommandValue('hiliteColor');
      const normalized = String(already || '').toLowerCase();
      const isOn =
        normalized.includes('fff59d') ||
        normalized.includes('255, 245, 157') ||
        normalized === 'yellow';
      try {
        document.execCommand('styleWithCSS', false, 'true');
      } catch {
        /* ignore */
      }
      document.execCommand('hiliteColor', false, isOn ? 'transparent' : HIGHLIGHT);
      // Fallback for browsers that ignore hiliteColor
      if (!isOn) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount && sel.toString()) {
          // hiliteColor usually works; if not, wrap with mark via insertHTML
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
          'note-rich-editor w-full bg-transparent px-0 text-sm leading-6 text-slate-800 outline-none',
          minHeightClass,
          '[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5',
          '[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5',
          '[&_mark]:rounded-sm [&_mark]:px-0.5',
          '[&:empty]:before:pointer-events-none [&:empty]:before:text-muted-foreground [&:empty]:before:content-[attr(data-placeholder)]',
          disabled && 'cursor-default opacity-80'
        )}
        onInput={emit}
        onBlur={emit}
        onKeyUp={() => bump((n) => n + 1)}
        onMouseUp={() => bump((n) => n + 1)}
      />
    </div>
  );
}

export function NoteHtmlPreview({
  html,
  className,
}: {
  html?: string | null;
  className?: string;
}) {
  const safe = sanitizeNoteHtml(plainTextToNoteHtml(html || ''));
  if (!safe) return null;
  return (
    <div
      className={cn(
        'note-rich-preview whitespace-pre-wrap text-sm leading-6 text-slate-800',
        '[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5',
        '[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5',
        '[&_mark]:rounded-sm [&_mark]:px-0.5',
        className
      )}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
