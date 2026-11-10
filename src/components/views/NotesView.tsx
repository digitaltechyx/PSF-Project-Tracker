"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  CheckSquare,
  Loader2,
  Pin,
  PinOff,
  Plus,
  Search,
  Share2,
  Trash2,
  StickyNote,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { NoteHtmlPreview, NoteRichEditor } from '@/components/notes/NoteRichEditor';
import { useToast } from '@/hooks/use-toast';
import { noteBodyHasContent, noteHtmlToPlainText, sanitizeNoteHtml } from '@/lib/note-html';
import { cn } from '@/lib/utils';
import type { NoteChecklistItem, NoteColor, WorkspaceNote } from '@/lib/types';

type ShareMode = 'everyone' | 'people';

const NOTE_COLORS: { id: NoteColor; label: string; bg: string; border: string }[] = [
  { id: 'default', label: 'Default', bg: 'bg-white', border: 'border-border/70' },
  { id: 'coral', label: 'Coral', bg: 'bg-[#f6aea9]', border: 'border-[#f6aea9]' },
  { id: 'peach', label: 'Peach', bg: 'bg-[#f9d3a8]', border: 'border-[#f9d3a8]' },
  { id: 'sand', label: 'Sand', bg: 'bg-[#fff4a3]', border: 'border-[#fff4a3]' },
  { id: 'mint', label: 'Mint', bg: 'bg-[#c6efc2]', border: 'border-[#c6efc2]' },
  { id: 'sage', label: 'Sage', bg: 'bg-[#b4ddd3]', border: 'border-[#b4ddd3]' },
  { id: 'fog', label: 'Fog', bg: 'bg-[#d4e4ed]', border: 'border-[#d4e4ed]' },
  { id: 'sky', label: 'Sky', bg: 'bg-[#aecbfa]', border: 'border-[#aecbfa]' },
  { id: 'lavender', label: 'Lavender', bg: 'bg-[#d7aefb]', border: 'border-[#d7aefb]' },
  { id: 'blush', label: 'Blush', bg: 'bg-[#fdcfe8]', border: 'border-[#fdcfe8]' },
  { id: 'stone', label: 'Stone', bg: 'bg-[#e8eaed]', border: 'border-[#e8eaed]' },
];

const AUTOSAVE_MS = 700;

function colorClasses(color?: NoteColor) {
  return NOTE_COLORS.find((c) => c.id === (color || 'default')) || NOTE_COLORS[0];
}

function newChecklistItem(text = ''): NoteChecklistItem {
  return {
    id: `ci_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text,
    done: false,
  };
}

function checklistHasContent(items: NoteChecklistItem[]) {
  return items.some((i) => i.text.trim());
}

function noteDraftHasContent(opts: {
  title: string;
  body: string;
  checklist: NoteChecklistItem[];
  useChecklist: boolean;
}) {
  if (opts.title.trim()) return true;
  if (opts.useChecklist) return checklistHasContent(opts.checklist);
  return noteBodyHasContent(opts.body);
}

function ColorPicker({
  value,
  onChange,
}: {
  value: NoteColor;
  onChange: (c: NoteColor) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {NOTE_COLORS.map((c) => (
        <button
          key={c.id}
          type="button"
          title={c.label}
          onClick={() => onChange(c.id)}
          className={cn(
            'h-6 w-6 rounded-full border shadow-sm transition ring-offset-1',
            c.bg,
            c.border,
            value === c.id && 'ring-2 ring-slate-700'
          )}
        />
      ))}
    </div>
  );
}

function SaveStatus({ status }: { status: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (status === 'idle') return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-600">
      {status === 'saving' && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          Saving…
        </>
      )}
      {status === 'saved' && 'Saved'}
      {status === 'error' && <span className="text-destructive">Couldn’t save</span>}
    </span>
  );
}

function noteShareLabel(note: WorkspaceNote, currentUserId?: string) {
  const shared = note.sharedWithUserIds || [];
  if (shared.length === 0) return 'Everyone';
  const others = shared.filter((id) => id !== currentUserId && id !== note.createdByUserId);
  if (others.length === 0) return 'Only you';
  return `${others.length} member${others.length === 1 ? '' : 's'}`;
}

export function NotesView({ store }: { store: any }) {
  const {
    workspaceNotes,
    isNotesLoading,
    createWorkspaceNote,
    updateWorkspaceNote,
    deleteWorkspaceNote,
    workspaceMembers,
    currentUser,
    isAdmin,
  } = store;
  const { toast } = useToast();

  const notes: WorkspaceNote[] = workspaceNotes || [];
  const members = workspaceMembers || [];
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  // Share dialog
  const [shareNote, setShareNote] = useState<WorkspaceNote | null>(null);
  const [shareMode, setShareMode] = useState<ShareMode>('everyone');
  const [shareIds, setShareIds] = useState<string[]>([]);
  const [shareSaving, setShareSaving] = useState(false);

  // Composer
  const [composerOpen, setComposerOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [draftColor, setDraftColor] = useState<NoteColor>('default');
  const [draftChecklist, setDraftChecklist] = useState<NoteChecklistItem[]>([]);
  const [useChecklist, setUseChecklist] = useState(false);
  const [composerNoteId, setComposerNoteId] = useState<string | null>(null);
  const [composerStatus, setComposerStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const composerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const composerBusyRef = useRef(false);
  const composerDraftRef = useRef({
    title: '',
    body: '',
    color: 'default' as NoteColor,
    checklist: [] as NoteChecklistItem[],
    useChecklist: false,
    noteId: null as string | null,
  });

  // Edit dialog
  const [editing, setEditing] = useState<WorkspaceNote | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editColor, setEditColor] = useState<NoteColor>('default');
  const [editChecklist, setEditChecklist] = useState<NoteChecklistItem[]>([]);
  const [editStatus, setEditStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const editTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editBusyRef = useRef(false);
  const editSnapshotRef = useRef('');
  const editDraftRef = useRef({
    id: '',
    title: '',
    body: '',
    color: 'default' as NoteColor,
    checklist: [] as NoteChecklistItem[],
  });
  const skipNextEditAutosaveRef = useRef(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes.filter((n) => {
      // Hide the note still open in the composer so it isn't shown twice
      if (composerOpen && composerNoteId && n.id === composerNoteId) return false;
      if (!!n.archived !== showArchived) return false;
      if (!q) return true;
      const hay = `${n.title} ${noteHtmlToPlainText(n.body)} ${(n.checklist || [])
        .map((i) => i.text)
        .join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [notes, search, showArchived, composerOpen, composerNoteId]);

  const pinned = filtered.filter((n) => n.pinned);
  const others = filtered.filter((n) => !n.pinned);

  useEffect(() => {
    composerDraftRef.current = {
      title: draftTitle,
      body: draftBody,
      color: draftColor,
      checklist: draftChecklist,
      useChecklist,
      noteId: composerNoteId,
    };
  }, [draftTitle, draftBody, draftColor, draftChecklist, useChecklist, composerNoteId]);

  useEffect(() => {
    if (!editing) return;
    editDraftRef.current = {
      id: editing.id,
      title: editTitle,
      body: editBody,
      color: editColor,
      checklist: editChecklist,
    };
  }, [editing, editTitle, editBody, editColor, editChecklist]);

  const resetComposerLocal = useCallback(() => {
    if (composerTimerRef.current) {
      clearTimeout(composerTimerRef.current);
      composerTimerRef.current = null;
    }
    setDraftTitle('');
    setDraftBody('');
    setDraftColor('default');
    setDraftChecklist([]);
    setUseChecklist(false);
    setComposerNoteId(null);
    setComposerStatus('idle');
    setComposerOpen(false);
  }, []);

  const persistComposer = useCallback(async () => {
    const draft = composerDraftRef.current;
    if (
      !noteDraftHasContent({
        title: draft.title,
        body: draft.body,
        checklist: draft.checklist,
        useChecklist: draft.useChecklist,
      })
    ) {
      return draft.noteId;
    }
    if (composerBusyRef.current) return draft.noteId;
    composerBusyRef.current = true;
    setComposerStatus('saving');
    try {
      const payload = {
        title: draft.title.trim(),
        body: draft.useChecklist ? '' : sanitizeNoteHtml(draft.body),
        color: draft.color,
        checklist: draft.useChecklist
          ? draft.checklist.filter((i) => i.text.trim())
          : [],
      };
      if (draft.noteId) {
        await updateWorkspaceNote(draft.noteId, payload);
        setComposerStatus('saved');
        return draft.noteId;
      }
      const id = await createWorkspaceNote(payload);
      setComposerNoteId(id);
      composerDraftRef.current.noteId = id;
      setComposerStatus('saved');
      return id as string;
    } catch (e: any) {
      setComposerStatus('error');
      toast({ variant: 'destructive', title: 'Could not save note', description: e?.message });
      return draft.noteId;
    } finally {
      composerBusyRef.current = false;
    }
  }, [createWorkspaceNote, updateWorkspaceNote, toast]);

  const closeComposer = useCallback(async () => {
    if (composerTimerRef.current) {
      clearTimeout(composerTimerRef.current);
      composerTimerRef.current = null;
    }
    await persistComposer();
    resetComposerLocal();
  }, [persistComposer, resetComposerLocal]);

  // Debounced autosave while composing a new note
  useEffect(() => {
    if (!composerOpen) return;
    if (
      !noteDraftHasContent({
        title: draftTitle,
        body: draftBody,
        checklist: draftChecklist,
        useChecklist,
      })
    ) {
      return;
    }
    if (composerTimerRef.current) clearTimeout(composerTimerRef.current);
    composerTimerRef.current = setTimeout(() => {
      void persistComposer();
    }, AUTOSAVE_MS);
    return () => {
      if (composerTimerRef.current) clearTimeout(composerTimerRef.current);
    };
  }, [
    composerOpen,
    draftTitle,
    draftBody,
    draftColor,
    draftChecklist,
    useChecklist,
    persistComposer,
  ]);

  const persistEdit = useCallback(async () => {
    const draft = editDraftRef.current;
    if (!draft.id) return;
    const nextSnapshot = JSON.stringify({
      title: draft.title.trim(),
      body: draft.body,
      color: draft.color,
      checklist: draft.checklist,
    });
    if (nextSnapshot === editSnapshotRef.current) return;
    if (editBusyRef.current) return;
    editBusyRef.current = true;
    setEditStatus('saving');
    try {
      const safeBody = sanitizeNoteHtml(draft.body);
      await updateWorkspaceNote(draft.id, {
        title: draft.title.trim(),
        body: safeBody,
        color: draft.color,
        checklist: draft.checklist,
      });
      editSnapshotRef.current = nextSnapshot;
      setEditStatus('saved');
      setEditing((prev) =>
        prev && prev.id === draft.id
          ? {
              ...prev,
              title: draft.title.trim(),
              body: safeBody,
              color: draft.color,
              checklist: draft.checklist,
            }
          : prev
      );
    } catch (e: any) {
      setEditStatus('error');
      toast({ variant: 'destructive', title: 'Could not save note', description: e?.message });
    } finally {
      editBusyRef.current = false;
    }
  }, [updateWorkspaceNote, toast]);

  const openEdit = (n: WorkspaceNote) => {
    if (editTimerRef.current) {
      clearTimeout(editTimerRef.current);
      editTimerRef.current = null;
    }
    skipNextEditAutosaveRef.current = true;
    setEditing(n);
    setEditTitle(n.title || '');
    setEditBody(n.body || '');
    setEditColor(n.color || 'default');
    setEditChecklist([...(n.checklist || [])]);
    setEditStatus('idle');
    editSnapshotRef.current = JSON.stringify({
      title: (n.title || '').trim(),
      body: n.body || '',
      color: n.color || 'default',
      checklist: n.checklist || [],
    });
  };

  const closeEdit = useCallback(async () => {
    if (editTimerRef.current) {
      clearTimeout(editTimerRef.current);
      editTimerRef.current = null;
    }
    if (editing && (isAdmin || editing.createdByUserId === currentUser?.uid)) {
      await persistEdit();
    }
    setEditing(null);
    setEditStatus('idle');
  }, [editing, isAdmin, currentUser?.uid, persistEdit]);

  // Debounced autosave while editing
  useEffect(() => {
    if (!editing) return;
    if (!(isAdmin || editing.createdByUserId === currentUser?.uid)) return;
    if (skipNextEditAutosaveRef.current) {
      skipNextEditAutosaveRef.current = false;
      return;
    }
    if (editTimerRef.current) clearTimeout(editTimerRef.current);
    editTimerRef.current = setTimeout(() => {
      void persistEdit();
    }, AUTOSAVE_MS);
    return () => {
      if (editTimerRef.current) clearTimeout(editTimerRef.current);
    };
  }, [
    editing,
    editTitle,
    editBody,
    editColor,
    editChecklist,
    isAdmin,
    currentUser?.uid,
    persistEdit,
  ]);

  // Flush composer/edit if user leaves Notes view mid-edit
  useEffect(() => {
    return () => {
      if (composerTimerRef.current) clearTimeout(composerTimerRef.current);
      if (editTimerRef.current) clearTimeout(editTimerRef.current);
      void persistComposer();
      const draft = editDraftRef.current;
      if (draft.id) {
        const nextSnapshot = JSON.stringify({
          title: draft.title.trim(),
          body: draft.body,
          color: draft.color,
          checklist: draft.checklist,
        });
        if (nextSnapshot !== editSnapshotRef.current) {
          void updateWorkspaceNote(draft.id, {
            title: draft.title.trim(),
            body: draft.body,
            color: draft.color,
            checklist: draft.checklist,
          });
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canEdit = (n: WorkspaceNote) =>
    isAdmin || n.createdByUserId === currentUser?.uid;

  const openShare = (n: WorkspaceNote) => {
    const shared = n.sharedWithUserIds || [];
    const isEveryone = shared.length === 0;
    setShareNote(n);
    setShareMode(isEveryone ? 'everyone' : 'people');
    setShareIds(
      isEveryone
        ? []
        : shared.filter((id) => id !== currentUser?.uid && id !== n.createdByUserId)
    );
  };

  const handleSaveShare = async () => {
    if (!shareNote) return;
    setShareSaving(true);
    try {
      const nextIds =
        shareMode === 'everyone'
          ? []
          : Array.from(
              new Set([
                shareNote.createdByUserId,
                ...(currentUser?.uid ? [currentUser.uid] : []),
                ...shareIds,
              ])
            );
      await updateWorkspaceNote(shareNote.id, { sharedWithUserIds: nextIds });
      if (editing?.id === shareNote.id) {
        setEditing({ ...editing, sharedWithUserIds: nextIds });
      }
      toast({
        title: 'Sharing updated',
        description:
          shareMode === 'everyone'
            ? 'Visible to everyone in the workspace.'
            : shareIds.length
              ? `Shared with ${shareIds.length} member${shareIds.length === 1 ? '' : 's'}.`
              : 'Only you can see this note.',
      });
      setShareNote(null);
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Could not update sharing',
        description: e?.message,
      });
    } finally {
      setShareSaving(false);
    }
  };

  const NoteCard = ({ note }: { note: WorkspaceNote }) => {
    const c = colorClasses(note.color);
    const checklist = note.checklist || [];
    return (
      <button
        type="button"
        onClick={() => openEdit(note)}
        className={cn(
          'group relative w-full break-inside-avoid rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
          c.bg,
          c.border
        )}
      >
        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
          {canEdit(note) && (
            <>
              <span
                role="button"
                tabIndex={0}
                className="rounded-full bg-white/80 p-1.5 shadow-sm hover:bg-white"
                title="Share"
                onClick={(e) => {
                  e.stopPropagation();
                  openShare(note);
                }}
              >
                <Share2 className="h-3.5 w-3.5" />
              </span>
              <span
                role="button"
                tabIndex={0}
                className="rounded-full bg-white/80 p-1.5 shadow-sm hover:bg-white"
                title={note.pinned ? 'Unpin' : 'Pin'}
                onClick={(e) => {
                  e.stopPropagation();
                  updateWorkspaceNote(note.id, { pinned: !note.pinned });
                }}
              >
                {note.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
              </span>
              <span
                role="button"
                tabIndex={0}
                className="rounded-full bg-white/80 p-1.5 shadow-sm hover:bg-white"
                title={note.archived ? 'Unarchive' : 'Archive'}
                onClick={(e) => {
                  e.stopPropagation();
                  updateWorkspaceNote(note.id, { archived: !note.archived, pinned: false });
                }}
              >
                <Archive className="h-3.5 w-3.5" />
              </span>
            </>
          )}
        </div>

        {note.pinned && (
          <Pin className="mb-2 h-3.5 w-3.5 text-slate-600" />
        )}
        {note.title ? (
          <h4 className="pr-20 line-clamp-3 text-sm font-semibold text-slate-900">{note.title}</h4>
        ) : null}
        {noteBodyHasContent(note.body) ? (
          <NoteHtmlPreview
            html={note.body}
            clamp
            className={cn(note.title && 'mt-2')}
          />
        ) : null}
        {checklist.length > 0 && (
          <div
            className={cn(
              'relative max-h-[240px] overflow-hidden',
              (note.title || noteBodyHasContent(note.body)) && 'mt-3'
            )}
          >
            <ul className="space-y-1.5 text-sm text-slate-800">
              {checklist.slice(0, 12).map((item) => (
                <li key={item.id} className="flex items-start gap-2">
                  <span
                    className={cn(
                      'mt-0.5 h-3.5 w-3.5 shrink-0 rounded border border-slate-500/50',
                      item.done && 'bg-slate-700'
                    )}
                  />
                  <span className={cn('break-words', item.done && 'line-through text-slate-500')}>
                    {item.text}
                  </span>
                </li>
              ))}
              {checklist.length > 12 && (
                <li className="text-xs text-slate-500">+{checklist.length - 12} more</li>
              )}
            </ul>
            {checklist.length > 6 && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/[0.06] to-transparent"
              />
            )}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-slate-500">
          <span className="truncate">{note.createdByName}</span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/70 px-1.5 py-0.5">
            <Users className="h-2.5 w-2.5" />
            {noteShareLabel(note, currentUser?.uid)}
          </span>
        </div>
      </button>
    );
  };

  if (isNotesLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-12 w-full rounded-2xl" />
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          <Skeleton className="mb-4 h-32 w-full rounded-2xl" />
          <Skeleton className="mb-4 h-48 w-full rounded-2xl" />
          <Skeleton className="mb-4 h-28 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Notes</h2>
          <p className="text-sm text-muted-foreground">
            Sticky notes with autosave — share any note with workspace members.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showArchived ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowArchived((v) => !v)}
          >
            <Archive className="mr-1.5 h-3.5 w-3.5" />
            {showArchived ? 'Archived' : 'Archive'}
          </Button>
        </div>
      </div>

      <div className="relative mx-auto max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notes"
          className="rounded-full border-border/70 bg-card pl-9 shadow-sm"
        />
      </div>

      {!showArchived && (
        <div
          className={cn(
            'mx-auto max-w-xl rounded-2xl border border-border/70 bg-card shadow-md transition',
            composerOpen && colorClasses(draftColor).bg
          )}
        >
          {!composerOpen ? (
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-muted-foreground"
            >
              <StickyNote className="h-4 w-4" />
              Take a note…
            </button>
          ) : (
            <div className="space-y-3 p-4">
              <Input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="Title"
                className="border-0 bg-transparent px-0 text-base font-semibold shadow-none focus-visible:ring-0"
                autoFocus
              />
              {useChecklist ? (
                <div className="space-y-2">
                  {draftChecklist.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={item.done}
                        onCheckedChange={(v) => {
                          setDraftChecklist((list) =>
                            list.map((x) => (x.id === item.id ? { ...x, done: !!v } : x))
                          );
                        }}
                      />
                      <Input
                        value={item.text}
                        onChange={(e) => {
                          setDraftChecklist((list) =>
                            list.map((x) => (x.id === item.id ? { ...x, text: e.target.value } : x))
                          );
                        }}
                        placeholder="List item"
                        className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            setDraftChecklist((list) => [...list, newChecklistItem()]);
                          }
                        }}
                      />
                      {draftChecklist.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            setDraftChecklist((list) => list.filter((_, i) => i !== idx))
                          }
                        >
                          ×
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-0 text-muted-foreground"
                    onClick={() => setDraftChecklist((list) => [...list, newChecklistItem()])}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> List item
                  </Button>
                </div>
              ) : (
                <NoteRichEditor
                  value={draftBody}
                  onChange={setDraftBody}
                  placeholder="Take a note…"
                  minHeightClass="min-h-[80px]"
                  maxHeightClass="max-h-[280px]"
                />
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/5 pt-3">
                <div className="flex items-center gap-2">
                  <ColorPicker value={draftColor} onChange={setDraftColor} />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title={useChecklist ? 'Switch to text' : 'Checklist'}
                    onClick={() => {
                      if (!useChecklist && draftChecklist.length === 0) {
                        setDraftChecklist([newChecklistItem()]);
                      }
                      setUseChecklist((v) => !v);
                    }}
                  >
                    <CheckSquare className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <SaveStatus status={composerStatus} />
                  <Button type="button" variant="ghost" size="sm" onClick={() => void closeComposer()}>
                    Close
                  </Button>
                  <Button type="button" size="sm" onClick={() => void closeComposer()}>
                    Done
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 py-16 text-center">
          <StickyNote className="mb-3 h-10 w-10 text-muted-foreground/60" />
          <p className="text-sm font-medium">
            {showArchived ? 'No archived notes' : 'No notes yet'}
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {showArchived
              ? 'Archived notes will show up here.'
              : 'Capture ideas, checklists, and reminders — like Google Keep, built into your workspace.'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {pinned.length > 0 && (
            <section>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Pinned
              </p>
              <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
                {pinned.map((n) => (
                  <div key={n.id} className="mb-4 break-inside-avoid">
                    <NoteCard note={n} />
                  </div>
                ))}
              </div>
            </section>
          )}
          {others.length > 0 && (
            <section>
              {pinned.length > 0 && (
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Others
                </p>
              )}
              <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
                {others.map((n) => (
                  <div key={n.id} className="mb-4 break-inside-avoid">
                    <NoteCard note={n} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) void closeEdit();
        }}
      >
        <DialogContent
          className={cn(
            'max-h-[90vh] max-w-lg overflow-y-auto border-0 sm:rounded-2xl',
            editing && colorClasses(editColor).bg
          )}
        >
          <DialogHeader>
            <DialogTitle className="sr-only">Edit note</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Title"
                className="border-0 bg-transparent px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
                disabled={!canEdit(editing)}
              />
              {editChecklist.length > 0 ? (
                <div className="space-y-2">
                  {editChecklist.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={item.done}
                        disabled={!canEdit(editing)}
                        onCheckedChange={(v) => {
                          setEditChecklist((list) =>
                            list.map((x) => (x.id === item.id ? { ...x, done: !!v } : x))
                          );
                        }}
                      />
                      <Input
                        value={item.text}
                        disabled={!canEdit(editing)}
                        onChange={(e) => {
                          setEditChecklist((list) =>
                            list.map((x) => (x.id === item.id ? { ...x, text: e.target.value } : x))
                          );
                        }}
                        className={cn(
                          'h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0',
                          item.done && 'line-through text-slate-500'
                        )}
                      />
                      {canEdit(editing) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            setEditChecklist((list) => list.filter((_, i) => i !== idx))
                          }
                        >
                          ×
                        </Button>
                      )}
                    </div>
                  ))}
                  {canEdit(editing) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-0"
                      onClick={() => setEditChecklist((list) => [...list, newChecklistItem()])}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" /> List item
                    </Button>
                  )}
                </div>
              ) : (
                <NoteRichEditor
                  value={editBody}
                  onChange={setEditBody}
                  placeholder="Note"
                  disabled={!canEdit(editing)}
                  minHeightClass="min-h-[140px]"
                  maxHeightClass="max-h-[min(50vh,420px)]"
                />
              )}
              {canEdit(editing) && <ColorPicker value={editColor} onChange={setEditColor} />}
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-600">
                  By {editing.createdByName}
                  <span className="ml-2 text-slate-500">
                    · {noteShareLabel(editing, currentUser?.uid)}
                  </span>
                </p>
                <SaveStatus status={editStatus} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            <div className="flex gap-1">
              {editing && canEdit(editing) && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title="Share"
                    onClick={() => openShare(editing)}
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title={editing.pinned ? 'Unpin' : 'Pin'}
                    onClick={() => {
                      updateWorkspaceNote(editing.id, { pinned: !editing.pinned });
                      setEditing({ ...editing, pinned: !editing.pinned });
                    }}
                  >
                    {editing.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title={editing.archived ? 'Unarchive' : 'Archive'}
                    onClick={async () => {
                      await persistEdit();
                      updateWorkspaceNote(editing.id, {
                        archived: !editing.archived,
                        pinned: false,
                      });
                      setEditing(null);
                    }}
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    title="Delete"
                    onClick={async () => {
                      if (editTimerRef.current) {
                        clearTimeout(editTimerRef.current);
                        editTimerRef.current = null;
                      }
                      await deleteWorkspaceNote(editing.id);
                      setEditing(null);
                      toast({ title: 'Note deleted' });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
            <Button type="button" onClick={() => void closeEdit()}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!shareNote}
        onOpenChange={(open) => {
          if (!open && !shareSaving) setShareNote(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share note</DialogTitle>
            <DialogDescription>
              Choose who in this workspace can see
              {shareNote?.title ? ` “${shareNote.title}”` : ' this note'}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <label
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5',
                shareMode === 'everyone' ? 'border-primary/40 bg-primary/5' : 'border-border/60'
              )}
            >
              <input
                type="radio"
                className="mt-1"
                checked={shareMode === 'everyone'}
                onChange={() => setShareMode('everyone')}
              />
              <div>
                <p className="text-sm font-medium">Everyone in workspace</p>
                <p className="text-xs text-muted-foreground">All members can view this note.</p>
              </div>
            </label>

            <label
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5',
                shareMode === 'people' ? 'border-primary/40 bg-primary/5' : 'border-border/60'
              )}
            >
              <input
                type="radio"
                className="mt-1"
                checked={shareMode === 'people'}
                onChange={() => setShareMode('people')}
              />
              <div>
                <p className="text-sm font-medium">Specific people</p>
                <p className="text-xs text-muted-foreground">
                  Only selected members (plus you). Leave none selected for only you.
                </p>
              </div>
            </label>

            {shareMode === 'people' && (
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-border/60 p-2">
                {members.filter((m: any) => m.userId !== currentUser?.uid).length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                    No other members in this workspace yet.
                  </p>
                ) : (
                  members
                    .filter((m: any) => m.userId !== currentUser?.uid)
                    .map((m: any) => {
                      const checked = shareIds.includes(m.userId);
                      return (
                        <label
                          key={m.userId}
                          className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) =>
                              setShareIds((ids) =>
                                v ? [...ids, m.userId] : ids.filter((id) => id !== m.userId)
                              )
                            }
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{m.displayName}</p>
                            <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                          </div>
                        </label>
                      );
                    })
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={shareSaving}
              onClick={() => setShareNote(null)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={shareSaving} onClick={() => void handleSaveShare()}>
              {shareSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save sharing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
