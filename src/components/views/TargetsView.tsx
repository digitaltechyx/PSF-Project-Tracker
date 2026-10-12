"use client";

import React, { useMemo, useState } from 'react';
import {
  Target as TargetIcon,
  Plus,
  Calendar,
  Link2,
  Link2Off,
  Trash2,
  ListChecks,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Settings2,
  Loader2,
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

const STATUS_LABEL: Record<TargetStatus, string> = {
  planned: 'Planned',
  in_progress: 'In progress',
  done: 'Done',
};

const STATUS_CLASS: Record<TargetStatus, string> = {
  planned: 'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-amber-50 text-amber-800 border-amber-200',
  done: 'bg-emerald-50 text-emerald-800 border-emerald-200',
};

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

function progressOf(t: Target) {
  const subs = t.subTargets || [];
  if (!subs.length) return t.status === 'done' ? 100 : t.status === 'in_progress' ? 50 : 0;
  const done = subs.filter((s) => s.status === 'done').length;
  return Math.round((done / subs.length) * 100);
}

type DraftSub = { title: string; startDate: string; endDate: string };

export function TargetsView({ store }: { store: any }) {
  const {
    workspaceTargets,
    isTargetsLoading,
    createTarget,
    updateTarget,
    deleteTarget,
    enableTargetShare,
    disableTargetShare,
    assignTargetAsTask,
    updateTargetsAccess,
    workspaceProjects,
    workspaceMembers,
    activeWorkspace,
    isAdmin,
    currentUser,
  } = store;
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [draftSubs, setDraftSubs] = useState<DraftSub[]>([]);
  const [saving, setSaving] = useState(false);

  const [accessIds, setAccessIds] = useState<string[]>([]);
  const [assignTarget, setAssignTarget] = useState<Target | null>(null);
  const [assignSub, setAssignSub] = useState<SubTarget | null>(null);
  const [assignProjectId, setAssignProjectId] = useState('');
  const [assigning, setAssigning] = useState(false);

  const targets: Target[] = workspaceTargets || [];
  const members = workspaceMembers || [];
  const projects = workspaceProjects || [];

  const nonAdminMembers = useMemo(
    () =>
      members.filter((m: any) => {
        const role = activeWorkspace?.memberRoles?.[m.userId];
        return role !== 'owner' && role !== 'lead';
      }),
    [members, activeWorkspace]
  );

  const openCreate = () => {
    setTitle('');
    setDescription('');
    setStartDate(todayISO());
    setEndDate(todayISO());
    setDraftSubs([]);
    setCreateOpen(true);
  };

  const openAccess = () => {
    setAccessIds([...(activeWorkspace?.targetsAllowedUserIds || [])]);
    setAccessOpen(true);
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
            status: 'planned' as TargetStatus,
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

  const handleShare = async (t: Target) => {
    setBusyId(t.id);
    try {
      if (t.shareEnabled && t.shareToken) {
        await disableTargetShare(t.id);
        toast({ title: 'Share link disabled' });
      } else {
        const token = await enableTargetShare(t.id);
        if (token && typeof window !== 'undefined') {
          const url = `${window.location.origin}/share/t/${token}`;
          await navigator.clipboard?.writeText(url);
          setCopiedToken(token);
          toast({ title: 'Share link copied', description: 'Anyone with the link can view (read-only).' });
        }
      }
    } catch {
      toast({ variant: 'destructive', title: 'Share action failed' });
    } finally {
      setBusyId(null);
    }
  };

  const copyShare = async (token: string) => {
    const url = `${window.location.origin}/share/t/${token}`;
    await navigator.clipboard?.writeText(url);
    setCopiedToken(token);
    toast({ title: 'Link copied' });
    setTimeout(() => setCopiedToken(null), 2000);
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

  const openAssign = (t: Target, sub?: SubTarget) => {
    setAssignTarget(t);
    setAssignSub(sub || null);
    setAssignProjectId(projects[0]?.id || '');
    setAssignOpen(true);
  };

  const handleAssign = async () => {
    if (!assignTarget || !assignProjectId) {
      toast({ variant: 'destructive', title: 'Choose a project' });
      return;
    }
    setAssigning(true);
    try {
      const titleText = assignSub ? assignSub.title : assignTarget.title;
      const due = assignSub?.endDate || assignTarget.endDate || null;
      const desc = assignSub
        ? `From target: ${assignTarget.title}\n${assignTarget.description || ''}`.trim()
        : assignTarget.description || '';
      const taskId = await assignTargetAsTask({
        projectId: assignProjectId,
        title: titleText,
        description: desc,
        dueDate: due,
        assigneeUserIds: currentUser?.id ? [currentUser.id] : [],
      });
      if (!taskId) throw new Error('Task was not created');
      toast({ title: 'Assigned as task', description: 'Opened in the chosen project.' });
      setAssignOpen(false);
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Could not assign as task',
        description: e?.message || 'Only admins can create tasks.',
      });
    } finally {
      setAssigning(false);
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
            Overall goals and sub-targets for {activeWorkspace?.name || 'this workspace'}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <Button variant="outline" className="gap-2" onClick={openAccess}>
              <Settings2 className="h-4 w-4" />
              Who can access
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
            Create an overall target with a start and end date, then break it into sub-targets.
          </p>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Create first target
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {targets.map((t) => {
            const open = expanded[t.id] ?? true;
            const pct = progressOf(t);
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
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold text-base truncate">{t.title}</h3>
                        <Badge variant="outline" className={cn('text-[10px] font-medium', STATUS_CLASS[t.status])}>
                          {STATUS_LABEL[t.status]}
                        </Badge>
                        {t.shareEnabled && (
                          <Badge variant="outline" className="text-[10px] gap-1 text-sky-700 border-sky-200 bg-sky-50">
                            <Link2 className="h-3 w-3" /> Shared
                          </Badge>
                        )}
                      </div>
                      {t.description ? (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{t.description}</p>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatRange(t.startDate, t.endDate)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <ListChecks className="h-3.5 w-3.5" />
                          {(t.subTargets || []).length} sub-target{(t.subTargets || []).length === 1 ? '' : 's'}
                        </span>
                        <span>{pct}% done</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/80 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" disabled={busyId === t.id}>
                          {busyId === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Actions'}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem onClick={() => handleStatus(t, 'planned')}>Mark planned</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatus(t, 'in_progress')}>Mark in progress</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatus(t, 'done')}>Mark done</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openAssign(t)}>
                          Assign as task…
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleShare(t)}>
                          {t.shareEnabled ? (
                            <><Link2Off className="h-4 w-4 mr-2" /> Disable share link</>
                          ) : (
                            <><Link2 className="h-4 w-4 mr-2" /> Share view link</>
                          )}
                        </DropdownMenuItem>
                        {t.shareEnabled && t.shareToken && (
                          <DropdownMenuItem onClick={() => copyShare(t.shareToken!)}>
                            {copiedToken === t.shareToken ? (
                              <><Check className="h-4 w-4 mr-2" /> Copied</>
                            ) : (
                              <><Copy className="h-4 w-4 mr-2" /> Copy link</>
                            )}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(t)}>
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
                        <div className="flex items-center gap-2">
                          <Select
                            value={s.status}
                            onValueChange={(v) => handleSubStatus(t, s.id, v as TargetStatus)}
                          >
                            <SelectTrigger className="h-8 w-[130px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="planned">Planned</SelectItem>
                              <SelectItem value="in_progress">In progress</SelectItem>
                              <SelectItem value="done">Done</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => openAssign(t, s)}>
                            To task
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New target</DialogTitle>
            <DialogDescription>Set an overall goal with a timeline. Add optional sub-targets.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="t-title">Title</Label>
              <Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Q4 product launch" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-desc">Description</Label>
              <Textarea id="t-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Optional context…" />
            </div>
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
                    setDraftSubs((d) => [...d, { title: '', startDate, endDate }])
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
                    <div key={i} className="rounded-xl border border-border/60 p-3 space-y-2">
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
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Access dialog */}
      <Dialog open={accessOpen} onOpenChange={setAccessOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Who can open Targets</DialogTitle>
            <DialogDescription>
              Admins always have access. Select members who can view and manage targets.
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

      {/* Assign as task */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign as task</DialogTitle>
            <DialogDescription>
              Create a task from {assignSub ? `“${assignSub.title}”` : `“${assignTarget?.title}”`} in a project you choose.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Project</Label>
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects available.</p>
            ) : (
              <Select value={assignProjectId} onValueChange={setAssignProjectId}>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={assigning || !assignProjectId}>
              {assigning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
