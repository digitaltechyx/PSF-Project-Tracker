"use client";

import React, { useMemo, useState } from 'react';
import {
  Target as TargetIcon,
  Plus,
  Calendar,
  Link2,
  Trash2,
  ListChecks,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Settings2,
  Loader2,
  Pencil,
  Share2,
  FolderPlus,
  ListTodo,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { SubTarget, Target, TargetStatus } from '@/lib/types';

const STATUS_OPTIONS: { value: TargetStatus; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'hold', label: 'Hold' },
  { value: 'complete', label: 'Complete' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_CLASS: Record<string, string> = {
  planned: 'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-amber-50 text-amber-800 border-amber-200',
  hold: 'bg-orange-50 text-orange-800 border-orange-200',
  complete: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  cancelled: 'bg-rose-50 text-rose-800 border-rose-200',
  done: 'bg-emerald-50 text-emerald-800 border-emerald-200',
};

function normalizeStatus(s?: string): TargetStatus {
  if (s === 'done') return 'complete';
  if (STATUS_OPTIONS.some((o) => o.value === s)) return s as TargetStatus;
  return 'planned';
}

function statusLabel(s?: string) {
  const n = normalizeStatus(s);
  return STATUS_OPTIONS.find((o) => o.value === n)?.label || 'Planned';
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatRange(start: string, end: string) {
  if (!start && !end) return 'No dates';
  try {
    const s = start ? new Date(start + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
    const e = end ? new Date(end + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
    return `${s} → ${e}`;
  } catch {
    return `${start} → ${end}`;
  }
}

type DraftSub = {
  id?: string;
  title: string;
  startDate: string;
  endDate: string;
  status?: TargetStatus;
};

export function TargetsView({ store }: { store: any }) {
  const {
    workspaceTargets,
    isTargetsLoading,
    createTarget,
    updateTarget,
    deleteTarget,
    createTargetTransfer,
    copyTargetAsTask,
    copyTargetAsProject,
    updateTargetsAccess,
    workspaceProjects,
    workspaceMembers,
    activeWorkspace,
    isAdmin,
    currentUser,
  } = store;
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<Target | null>(null);
  const [editStatus, setEditStatus] = useState<TargetStatus>('planned');
  const [accessOpen, setAccessOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTargetIds, setShareTargetIds] = useState<string[]>([]);
  const [shareRecipient, setShareRecipient] = useState<'link' | 'member'>('link');
  const [shareMemberId, setShareMemberId] = useState('');
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyMode, setCopyMode] = useState<'task' | 'project'>('task');
  const [copyTarget, setCopyTarget] = useState<Target | null>(null);
  const [copyProjectId, setCopyProjectId] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [draftSubs, setDraftSubs] = useState<DraftSub[]>([]);
  const [saving, setSaving] = useState(false);
  const [accessIds, setAccessIds] = useState<string[]>([]);

  const targets: Target[] = workspaceTargets || [];
  const members = workspaceMembers || [];
  const projects = workspaceProjects || [];

  const nonAdminMembers = useMemo(
    () =>
      members.filter((m: any) => {
        const role = activeWorkspace?.memberRoles?.[m.userId];
        return role !== 'owner' && role !== 'lead' && m.userId !== currentUser?.id;
      }),
    [members, activeWorkspace, currentUser?.id]
  );

  const shareableMembers = useMemo(
    () => members.filter((m: any) => m.userId !== currentUser?.id),
    [members, currentUser?.id]
  );

  const openCreate = () => {
    setEditingTarget(null);
    setTitle('');
    setDescription('');
    setStartDate(todayISO());
    setEndDate(todayISO());
    setEditStatus('planned');
    setDraftSubs([]);
    setCreateOpen(true);
  };

  const openEdit = (t: Target) => {
    setEditingTarget(t);
    setTitle(t.title || '');
    setDescription(t.description || '');
    setStartDate(t.startDate || todayISO());
    setEndDate(t.endDate || todayISO());
    setEditStatus(normalizeStatus(t.status));
    setDraftSubs(
      (t.subTargets || []).map((s) => ({
        id: s.id,
        title: s.title,
        startDate: s.startDate,
        endDate: s.endDate,
        status: normalizeStatus(s.status),
      }))
    );
    setEditOpen(true);
  };

  const openShare = (ids: string[]) => {
    setShareTargetIds(ids);
    setShareRecipient('link');
    setShareMemberId('');
    setShareLink(null);
    setCopiedLink(false);
    setShareOpen(true);
  };

  const openAccess = () => {
    setAccessIds([...(activeWorkspace?.targetsAllowedUserIds || [])]);
    setAccessOpen(true);
  };

  const openCopyTask = (t: Target) => {
    setCopyTarget(t);
    setCopyMode('task');
    setCopyProjectId(projects[0]?.id || '');
    setCopyOpen(true);
  };

  const openCopyProject = (t: Target) => {
    setCopyTarget(t);
    setCopyMode('project');
    setCopyOpen(true);
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast({ variant: 'destructive', title: 'Title required' });
      return;
    }
    if (endDate < startDate) {
      toast({ variant: 'destructive', title: 'End date must be on or after start' });
      return;
    }
    setSaving(true);
    try {
      await createTarget({
        title: title.trim(),
        description,
        startDate,
        endDate,
        subTargets: draftSubs
          .filter((s) => s.title.trim())
          .map((s) => ({
            title: s.title.trim(),
            startDate: s.startDate || startDate,
            endDate: s.endDate || endDate,
            status: normalizeStatus(s.status),
          })),
      });
      toast({ title: 'Target created' });
      setCreateOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Could not create target', description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingTarget) return;
    if (!title.trim()) {
      toast({ variant: 'destructive', title: 'Title required' });
      return;
    }
    if (endDate < startDate) {
      toast({ variant: 'destructive', title: 'End date must be on or after start' });
      return;
    }
    setSaving(true);
    try {
      const subTargets: SubTarget[] = draftSubs
        .filter((s) => s.title.trim())
        .map((s, i) => ({
          id: s.id || `st_${Date.now().toString(36)}_${i}`,
          title: s.title.trim(),
          startDate: s.startDate || startDate,
          endDate: s.endDate || endDate,
          status: normalizeStatus(s.status),
        }));
      await updateTarget(editingTarget.id, {
        title: title.trim(),
        description: description.trim(),
        startDate,
        endDate,
        status: editStatus,
        subTargets,
      });
      toast({ title: 'Target updated' });
      setEditOpen(false);
      setEditingTarget(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Could not save', description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAccess = async () => {
    setSaving(true);
    try {
      await updateTargetsAccess(accessIds);
      toast({ title: 'Targets access updated' });
      setAccessOpen(false);
    } catch {
      toast({ variant: 'destructive', title: 'Failed to update access' });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateShare = async () => {
    if (!shareTargetIds.length) {
      toast({ variant: 'destructive', title: 'Select at least one target' });
      return;
    }
    setSaving(true);
    try {
      let toUserId: string | null = null;
      let toUserName: string | null = null;
      if (shareRecipient === 'member') {
        if (!shareMemberId) {
          toast({ variant: 'destructive', title: 'Choose a member' });
          setSaving(false);
          return;
        }
        const m = shareableMembers.find((x: any) => x.userId === shareMemberId);
        toUserId = shareMemberId;
        toUserName = m?.displayName || m?.email || null;
      }
      const token = await createTargetTransfer({
        targetIds: shareTargetIds,
        toUserId,
        toUserName,
      });
      const url = `${window.location.origin}/share/t/${token}`;
      setShareLink(url);
      await navigator.clipboard?.writeText(url);
      setCopiedLink(true);
      toast({
        title: 'Share link ready',
        description: 'They open the link, pick a workspace if needed, and get their own copies.',
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Share failed', description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareLink) return;
    await navigator.clipboard?.writeText(shareLink);
    setCopiedLink(true);
    toast({ title: 'Link copied' });
  };

  const handleStatus = async (t: Target, status: TargetStatus) => {
    await updateTarget(t.id, { status });
  };

  const handleSubStatus = async (t: Target, subId: string, status: TargetStatus) => {
    const subTargets = (t.subTargets || []).map((s) => (s.id === subId ? { ...s, status } : s));
    await updateTarget(t.id, { subTargets });
  };

  const handleDelete = async (t: Target) => {
    if (!confirm(`Delete target “${t.title}”?`)) return;
    setBusyId(t.id);
    try {
      await deleteTarget(t.id);
      toast({ title: 'Target deleted' });
    } catch {
      toast({ variant: 'destructive', title: 'Delete failed' });
    } finally {
      setBusyId(null);
    }
  };

  const handleCopy = async () => {
    if (!copyTarget) return;
    setSaving(true);
    try {
      if (copyMode === 'project') {
        const projId = await copyTargetAsProject(copyTarget.id);
        if (!projId) throw new Error('Project was not created');
        toast({ title: 'Copied as project', description: 'Original target is unchanged.' });
      } else {
        if (!copyProjectId) {
          toast({ variant: 'destructive', title: 'Choose a project' });
          setSaving(false);
          return;
        }
        const taskId = await copyTargetAsTask({
          projectId: copyProjectId,
          title: copyTarget.title,
          description: copyTarget.description || '',
          dueDate: copyTarget.endDate || null,
          assigneeUserIds: currentUser?.id ? [currentUser.id] : [],
        });
        if (!taskId) throw new Error('Task was not created');
        toast({ title: 'Copied as task', description: 'Original target is unchanged.' });
      }
      setCopyOpen(false);
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Copy failed',
        description: e?.message || 'Only admins can create projects/tasks.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (isTargetsLoading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="page-subheading">
            Write and manage goals for {activeWorkspace?.name || 'this workspace'}. Share copies with members or anyone via link.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <Button variant="outline" className="gap-2" onClick={openAccess}>
              <Settings2 className="h-4 w-4" />
              Who can access
            </Button>
          )}
          {targets.length > 0 && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => openShare(targets.map((t) => t.id))}
            >
              <Share2 className="h-4 w-4" />
              Share all
            </Button>
          )}
          <Button className="gap-2 shadow-sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New target
          </Button>
        </div>
      </div>

      {targets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-card/40 px-6 py-16 text-center">
          <TargetIcon className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <h3 className="font-semibold text-lg mb-1">No targets yet</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
            Create a target with a start and end date, then optionally break it into sub-targets.
          </p>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Create first target
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {targets.map((t) => {
            const open = expanded[t.id] ?? true;
            const st = normalizeStatus(t.status);
            return (
              <div
                key={t.id}
                className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden"
              >
                <div className="p-4 sm:p-5 flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      className="mt-0.5 text-muted-foreground hover:text-foreground"
                      onClick={() => setExpanded((e) => ({ ...e, [t.id]: !open }))}
                      aria-label={open ? 'Collapse' : 'Expand'}
                    >
                      {open ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    </button>
                    <button
                      type="button"
                      className="flex-1 min-w-0 text-left rounded-xl -m-1 p-1 hover:bg-muted/40 transition-colors"
                      onClick={() => openEdit(t)}
                    >
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold text-base truncate">{t.title}</h3>
                        <Badge variant="outline" className={cn('text-[10px] font-medium', STATUS_CLASS[st])}>
                          {statusLabel(st)}
                        </Badge>
                        {t.copiedFromTransferId && (
                          <Badge variant="outline" className="text-[10px] gap-1 text-sky-700 border-sky-200 bg-sky-50">
                            Received copy
                          </Badge>
                        )}
                      </div>
                      {t.description ? (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2 whitespace-pre-wrap">{t.description}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground/60 italic mb-2">No description — click to add</p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatRange(t.startDate, t.endDate)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <ListChecks className="h-3.5 w-3.5" />
                          {(t.subTargets || []).length} sub-target{(t.subTargets || []).length === 1 ? '' : 's'}
                        </span>
                      </div>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => openEdit(t)}>
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Edit</span>
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => openShare([t.id])}>
                        <Share2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Share</span>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" disabled={busyId === t.id}>
                            {busyId === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Actions'}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          {STATUS_OPTIONS.map((o) => (
                            <DropdownMenuItem key={o.value} onClick={() => handleStatus(t, o.value)}>
                              Mark {o.label.toLowerCase()}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openCopyTask(t)}>
                            <ListTodo className="h-4 w-4 mr-2" /> Copy as task…
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openCopyProject(t)}>
                            <FolderPlus className="h-4 w-4 mr-2" /> Copy as project
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openShare([t.id])}>
                            <Share2 className="h-4 w-4 mr-2" /> Share…
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(t)}>
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>

                {open && (t.subTargets || []).length > 0 && (
                  <div className="border-t border-border/50 bg-muted/20 px-4 sm:px-5 py-3 space-y-2">
                    {(t.subTargets || []).map((s) => (
                      <div
                        key={s.id}
                        className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-xl bg-background/80 border border-border/40 px-3 py-2.5"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{s.title}</p>
                          <p className="text-[11px] text-muted-foreground">{formatRange(s.startDate, s.endDate)}</p>
                        </div>
                        <Select
                          value={normalizeStatus(s.status)}
                          onValueChange={(v) => handleSubStatus(t, s.id, v as TargetStatus)}
                        >
                          <SelectTrigger className="h-8 w-[140px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New target</DialogTitle>
            <DialogDescription>Set a goal with a timeline. Add optional sub-targets.</DialogDescription>
          </DialogHeader>
          <TargetFormFields
            title={title}
            setTitle={setTitle}
            description={description}
            setDescription={setDescription}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            draftSubs={draftSubs}
            setDraftSubs={setDraftSubs}
            status={editStatus}
            setStatus={setEditStatus}
            showStatus={false}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditingTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Target details</DialogTitle>
            <DialogDescription>View and edit description, dates, status, and sub-targets.</DialogDescription>
          </DialogHeader>
          <TargetFormFields
            title={title}
            setTitle={setTitle}
            description={description}
            setDescription={setDescription}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            draftSubs={draftSubs}
            setDraftSubs={setDraftSubs}
            status={editStatus}
            setStatus={setEditStatus}
            showStatus
            descriptionRows={8}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy-share: one, many, or all → recipient gets their own copies */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Share targets</DialogTitle>
            <DialogDescription>
              Recipients get their own copies in a workspace they choose. Your originals stay unchanged.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Which targets</Label>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setShareTargetIds(targets.map((t) => t.id))}
                  >
                    All
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setShareTargetIds([])}
                  >
                    None
                  </Button>
                </div>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-2 rounded-xl border border-border/50 p-2">
                {targets.map((t) => {
                  const checked = shareTargetIds.includes(t.id);
                  return (
                    <label
                      key={t.id}
                      className="flex items-center gap-3 rounded-lg px-2 py-1.5 cursor-pointer hover:bg-muted/40"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          setShareTargetIds((ids) =>
                            v ? [...ids, t.id] : ids.filter((id) => id !== t.id)
                          );
                        }}
                      />
                      <span className="text-sm truncate">{t.title}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">{shareTargetIds.length} selected</p>
            </div>

            <div className="space-y-2">
              <Label>Share with</Label>
              <Select
                value={shareRecipient}
                onValueChange={(v) => setShareRecipient(v as 'link' | 'member')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="link">Anyone with a link (not a member)</SelectItem>
                  <SelectItem value="member">A workspace member</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {shareRecipient === 'member' && (
              <div className="space-y-2">
                <Label>Member</Label>
                {shareableMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No other members.</p>
                ) : (
                  <Select value={shareMemberId} onValueChange={setShareMemberId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose member" />
                    </SelectTrigger>
                    <SelectContent>
                      {shareableMembers.map((m: any) => (
                        <SelectItem key={m.userId} value={m.userId}>
                          {m.displayName || m.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {shareLink ? (
              <div className="space-y-2 rounded-xl border border-border/50 bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Send this link. They sign in and copy targets into their workspace.</p>
                <Input readOnly value={shareLink} className="text-xs" />
                <Button size="sm" variant="outline" className="gap-1.5" onClick={handleCopyLink}>
                  {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  Copy link
                </Button>
              </div>
            ) : (
              <Button className="w-full gap-1.5" onClick={handleCreateShare} disabled={saving || !shareTargetIds.length}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                Create share link
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={accessOpen} onOpenChange={setAccessOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Who can open Targets</DialogTitle>
            <DialogDescription>
              Admins always have access. Selected members can open the Targets page (they see targets shared with them or that they created).
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto space-y-2 py-2">
            {nonAdminMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No non-admin members yet.</p>
            ) : (
              nonAdminMembers.map((m: any) => {
                const checked = accessIds.includes(m.userId);
                return (
                  <label
                    key={m.userId}
                    className="flex items-center gap-3 rounded-xl border border-border/50 px-3 py-2.5 cursor-pointer hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        setAccessIds((ids) =>
                          v ? [...ids, m.userId] : ids.filter((id) => id !== m.userId)
                        );
                      }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{m.displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    </div>
                  </label>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccessOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveAccess} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{copyMode === 'project' ? 'Copy as project' : 'Copy as task'}</DialogTitle>
            <DialogDescription>
              Creates a {copyMode} from “{copyTarget?.title}”. The original target stays as-is.
            </DialogDescription>
          </DialogHeader>
          {copyMode === 'task' && (
            <div className="space-y-3 py-2">
              <Label>Project</Label>
              {projects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No projects available.</p>
              ) : (
                <Select value={copyProjectId} onValueChange={setCopyProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
          {copyMode === 'project' && (
            <p className="text-sm text-muted-foreground py-2">
              A new project will be created with this target’s title and description. Sub-targets become tasks.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyOpen(false)}>Cancel</Button>
            <Button onClick={handleCopy} disabled={saving || (copyMode === 'task' && !copyProjectId)}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {copyMode === 'project' ? 'Create project copy' : 'Create task copy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TargetFormFields({
  title,
  setTitle,
  description,
  setDescription,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  draftSubs,
  setDraftSubs,
  status,
  setStatus,
  showStatus,
  descriptionRows = 3,
}: {
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  draftSubs: DraftSub[];
  setDraftSubs: React.Dispatch<React.SetStateAction<DraftSub[]>>;
  status: TargetStatus;
  setStatus: (v: TargetStatus) => void;
  showStatus: boolean;
  descriptionRows?: number;
}) {
  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label htmlFor="t-title">Title</Label>
        <Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Q4 product launch" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="t-desc">Description</Label>
        <Textarea
          id="t-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={descriptionRows}
          placeholder="Full details, notes, scope…"
          className="min-h-[120px] resize-y"
        />
      </div>
      {showStatus && (
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={normalizeStatus(status)} onValueChange={(v) => setStatus(v as TargetStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="t-start">Start</Label>
          <Input id="t-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="t-end">End</Label>
          <Input id="t-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Sub-targets</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1"
            onClick={() =>
              setDraftSubs((d) => [...d, { title: '', startDate, endDate, status: 'planned' }])
            }
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
        {draftSubs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Optional. Break the goal into smaller pieces.</p>
        ) : (
          <div className="space-y-3">
            {draftSubs.map((s, i) => (
              <div key={s.id || i} className="rounded-xl border border-border/60 p-3 space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Sub-target title"
                    value={s.title}
                    onChange={(e) => {
                      const next = [...draftSubs];
                      next[i] = { ...next[i], title: e.target.value };
                      setDraftSubs(next);
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => setDraftSubs((d) => d.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={s.startDate}
                    onChange={(e) => {
                      const next = [...draftSubs];
                      next[i] = { ...next[i], startDate: e.target.value };
                      setDraftSubs(next);
                    }}
                  />
                  <Input
                    type="date"
                    value={s.endDate}
                    onChange={(e) => {
                      const next = [...draftSubs];
                      next[i] = { ...next[i], endDate: e.target.value };
                      setDraftSubs(next);
                    }}
                  />
                </div>
                {showStatus && (
                  <Select
                    value={normalizeStatus(s.status)}
                    onValueChange={(v) => {
                      const next = [...draftSubs];
                      next[i] = { ...next[i], status: v as TargetStatus };
                      setDraftSubs(next);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
