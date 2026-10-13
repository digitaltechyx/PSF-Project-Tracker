"use client";

import React, { useMemo, useState } from 'react';
import {
  FileSpreadsheet,
  FileText,
  ExternalLink,
  Plus,
  Share2,
  Trash2,
  Loader2,
  Presentation,
  Link2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { buildGoogleOpenUrl, googleDocKindLabel } from '@/lib/google-docs';
import type { WorkspaceDoc } from '@/lib/types';

function KindIcon({ kind }: { kind: WorkspaceDoc['kind'] }) {
  if (kind === 'spreadsheet') return <FileSpreadsheet className="h-4 w-4 text-emerald-600" />;
  if (kind === 'presentation') return <Presentation className="h-4 w-4 text-amber-600" />;
  return <FileText className="h-4 w-4 text-sky-600" />;
}

export function DocsView({ store }: { store: any }) {
  const {
    workspaceDocs,
    isDocsLoading,
    createWorkspaceDoc,
    updateWorkspaceDoc,
    deleteWorkspaceDoc,
    workspaceMembers,
    activeWorkspace,
    currentUser,
    isAdmin,
  } = store;
  const { toast } = useToast();

  const docs: WorkspaceDoc[] = workspaceDocs || [];
  const members = workspaceMembers || [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [shareIds, setShareIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const selected = useMemo(
    () => docs.find((d) => d.id === selectedId) || docs[0] || null,
    [docs, selectedId]
  );

  const openAdd = () => {
    setTitle('');
    setUrl('');
    setAddOpen(true);
  };

  const openShare = (d: WorkspaceDoc) => {
    setSelectedId(d.id);
    setShareIds([...(d.sharedWithUserIds || [])]);
    setShareOpen(true);
  };

  const handleAdd = async () => {
    setSaving(true);
    try {
      const id = await createWorkspaceDoc({ title, url });
      setSelectedId(id);
      setAddOpen(false);
      toast({ title: 'Doc added', description: 'Opened in the viewer. Share Google access separately if needed.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Could not add', description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveShare = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await updateWorkspaceDoc(selected.id, { sharedWithUserIds: shareIds });
      toast({
        title: 'Sharing updated',
        description: shareIds.length ? 'Visible to selected members.' : 'Visible to everyone in the workspace.',
      });
      setShareOpen(false);
    } catch {
      toast({ variant: 'destructive', title: 'Could not update sharing' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (d: WorkspaceDoc) => {
    if (!confirm(`Remove “${d.title}” from Docs? (Does not delete the Google file.)`)) return;
    try {
      await deleteWorkspaceDoc(d.id);
      if (selectedId === d.id) setSelectedId(null);
      toast({ title: 'Removed from Docs' });
    } catch {
      toast({ variant: 'destructive', title: 'Delete failed' });
    }
  };

  const canManage = (d: WorkspaceDoc) =>
    isAdmin || d.createdByUserId === currentUser?.id;

  if (isDocsLoading) {
    return (
      <div className="space-y-4 max-w-6xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[60vh] w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] min-h-[480px] max-w-6xl mx-auto flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="page-subheading">
            Open Google Docs & Sheets inside {activeWorkspace?.name || 'this workspace'}. Add links, view in-app, share with members.
          </p>
        </div>
        <Button className="gap-2 shadow-sm shrink-0" onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Add Doc / Sheet
        </Button>
      </div>

      <div className="flex-1 min-h-0 rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden flex">
        <aside className="w-64 shrink-0 border-r border-border/60 bg-muted/15 flex flex-col">
          <div className="px-3 py-2.5 border-b border-border/50 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Library ({docs.length})
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-0.5">
              {docs.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-6 text-center">
                  No docs yet. Add a Google Doc or Sheet link.
                </p>
              )}
              {docs.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedId(d.id)}
                  className={cn(
                    'w-full text-left rounded-xl px-2.5 py-2.5 hover:bg-muted/60 transition-colors',
                    selected?.id === d.id && 'bg-muted font-medium'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <KindIcon kind={d.kind} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{d.title}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {googleDocKindLabel(d.kind)}
                        {(d.sharedWithUserIds || []).length > 0 ? ' · Limited share' : ' · Workspace'}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          {!selected ? (
            <div className="flex-1 grid place-items-center text-center px-6">
              <div>
                <Link2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <h3 className="font-semibold mb-1">Add a Google Doc or Sheet</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
                  Paste a share link to view it here. Viewers must also have Google access to that file.
                </p>
                <Button onClick={openAdd} className="gap-2">
                  <Plus className="h-4 w-4" /> Add first file
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="h-14 border-b border-border/60 px-4 flex items-center gap-2 shrink-0">
                <KindIcon kind={selected.kind} />
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold truncate text-sm sm:text-base">{selected.title}</h2>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {googleDocKindLabel(selected.kind)} · by {selected.createdByName}
                  </p>
                </div>
                <Badge variant="outline" className="hidden sm:inline-flex text-[10px]">
                  In-app view
                </Badge>
                {canManage(selected) && (
                  <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => openShare(selected)}>
                    <Share2 className="h-3.5 w-3.5" />
                    Share
                  </Button>
                )}
                <Button variant="outline" size="sm" className="gap-1.5 h-8" asChild>
                  <a href={buildGoogleOpenUrl(selected.kind, selected.fileId)} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open
                  </a>
                </Button>
                {canManage(selected) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDelete(selected)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="flex-1 min-h-0 bg-muted/20 relative">
                <iframe
                  key={selected.id}
                  title={selected.title}
                  src={selected.embedUrl}
                  className="absolute inset-0 w-full h-full border-0 bg-white"
                  allow="clipboard-read; clipboard-write"
                />
              </div>
              <p className="text-[10px] text-muted-foreground px-4 py-2 border-t border-border/50">
                Tip: In Google, share the file with “Anyone with the link” or the same people — otherwise the embed may ask them to sign in to Google.
              </p>
            </>
          )}
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Google Doc or Sheet</DialogTitle>
            <DialogDescription>
              Paste a Google Docs or Sheets link. It will open inside Docs for people you share with here.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="e.g. Q4 budget"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Google link</Label>
              <Input
                placeholder="https://docs.google.com/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving || !url.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share in workspace</DialogTitle>
            <DialogDescription>
              Who can see this in Docs. Leave none selected to share with the whole workspace. Google file permissions are separate.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto space-y-2 py-2">
            {members
              .filter((m: any) => m.userId !== currentUser?.id)
              .map((m: any) => {
                const checked = shareIds.includes(m.userId);
                return (
                  <label
                    key={m.userId}
                    className="flex items-center gap-3 rounded-xl border border-border/50 px-3 py-2 cursor-pointer hover:bg-muted/40"
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
                      <p className="text-sm font-medium truncate">{m.displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    </div>
                  </label>
                );
              })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveShare} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
