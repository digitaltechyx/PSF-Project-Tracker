"use client";

import React, { useMemo, useState } from 'react';
import {
  Archive,
  CheckSquare,
  Loader2,
  Pin,
  PinOff,
  Plus,
  Search,
  Trash2,
  StickyNote,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { NoteChecklistItem, NoteColor, WorkspaceNote } from '@/lib/types';

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

export function NotesView({ store }: { store: any }) {
  const {
    workspaceNotes,
    isNotesLoading,
    createWorkspaceNote,
    updateWorkspaceNote,
    deleteWorkspaceNote,
    currentUser,
    isAdmin,
  } = store;
  const { toast } = useToast();

  const notes: WorkspaceNote[] = workspaceNotes || [];
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  // Composer
  const [composerOpen, setComposerOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [draftColor, setDraftColor] = useState<NoteColor>('default');
  const [draftChecklist, setDraftChecklist] = useState<NoteChecklistItem[]>([]);
  const [useChecklist, setUseChecklist] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit dialog
  const [editing, setEditing] = useState<WorkspaceNote | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editColor, setEditColor] = useState<NoteColor>('default');
  const [editChecklist, setEditChecklist] = useState<NoteChecklistItem[]>([]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes.filter((n) => {
      if (!!n.archived !== showArchived) return false;
      if (!q) return true;
      const hay = `${n.title} ${n.body} ${(n.checklist || []).map((i) => i.text).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [notes, search, showArchived]);

  const pinned = filtered.filter((n) => n.pinned);
  const others = filtered.filter((n) => !n.pinned);

  const resetComposer = () => {
    setDraftTitle('');
    setDraftBody('');
    setDraftColor('default');
    setDraftChecklist([]);
    setUseChecklist(false);
    setComposerOpen(false);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await createWorkspaceNote({
        title: draftTitle,
        body: useChecklist ? '' : draftBody,
        color: draftColor,
        checklist: useChecklist ? draftChecklist.filter((i) => i.text.trim()) : [],
      });
      resetComposer();
      toast({ title: 'Note saved' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Could not save', description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (n: WorkspaceNote) => {
    setEditing(n);
    setEditTitle(n.title || '');
    setEditBody(n.body || '');
    setEditColor(n.color || 'default');
    setEditChecklist([...(n.checklist || [])]);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await updateWorkspaceNote(editing.id, {
        title: editTitle.trim(),
        body: editBody,
        color: editColor,
        checklist: editChecklist,
      });
      setEditing(null);
      toast({ title: 'Note updated' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Could not update', description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  const canEdit = (n: WorkspaceNote) =>
    isAdmin || n.createdByUserId === currentUser?.uid;

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
          <h4 className="pr-14 text-sm font-semibold text-slate-900">{note.title}</h4>
        ) : null}
        {note.body ? (
          <p className={cn('whitespace-pre-wrap text-sm leading-6 text-slate-800', note.title && 'mt-2')}>
            {note.body}
          </p>
        ) : null}
        {checklist.length > 0 && (
          <ul className={cn('space-y-1.5 text-sm text-slate-800', (note.title || note.body) && 'mt-3')}>
            {checklist.slice(0, 8).map((item) => (
              <li key={item.id} className="flex items-start gap-2">
                <span
                  className={cn(
                    'mt-0.5 h-3.5 w-3.5 shrink-0 rounded border border-slate-500/50',
                    item.done && 'bg-slate-700'
                  )}
                />
                <span className={cn(item.done && 'line-through text-slate-500')}>{item.text}</span>
              </li>
            ))}
            {checklist.length > 8 && (
              <li className="text-xs text-slate-500">+{checklist.length - 8} more</li>
            )}
          </ul>
        )}
        <p className="mt-3 text-[10px] text-slate-500">
          {note.createdByName}
        </p>
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
            Keep-style sticky notes for your workspace — quick thoughts, lists, and reminders.
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
                <Textarea
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  placeholder="Take a note…"
                  className="min-h-[80px] resize-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
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
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={resetComposer}>
                    Close
                  </Button>
                  <Button type="button" size="sm" disabled={saving} onClick={handleCreate}>
                    {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
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

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent
          className={cn(
            'max-w-lg border-0 sm:rounded-2xl',
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
                <Textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  placeholder="Note"
                  disabled={!canEdit(editing)}
                  className="min-h-[140px] resize-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
              )}
              {canEdit(editing) && <ColorPicker value={editColor} onChange={setEditColor} />}
              <p className="text-xs text-slate-600">By {editing.createdByName}</p>
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
                    onClick={() => {
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
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Close
              </Button>
              {editing && canEdit(editing) && (
                <Button type="button" disabled={saving} onClick={handleSaveEdit}>
                  {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Save
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
