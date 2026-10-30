"use client";

import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Box,
  CheckCircle2,
  FolderKanban,
  Layers,
  ListTodo,
  Plus,
  Trash2,
  Loader2,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { isTaskClosed } from '@/lib/pipelines';
import { getDateKeyInTimeZone, resolveWorkspaceTimezone } from '@/lib/timezone';

function KpiTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'slate',
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'slate' | 'blue' | 'emerald' | 'rose' | 'amber';
}) {
  const tones = {
    slate: 'from-slate-50 to-white text-slate-800',
    blue: 'from-sky-50/80 to-white text-sky-800',
    emerald: 'from-emerald-50/80 to-white text-emerald-800',
    rose: 'from-rose-50/80 to-white text-rose-800',
    amber: 'from-amber-50/80 to-white text-amber-900',
  };
  return (
    <div
      className={cn(
        'rounded-2xl border border-border/70 bg-gradient-to-br p-4 shadow-sm',
        tones[tone]
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-600">{hint}</p>}
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/80 text-slate-700">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

export function ProgramDashboardView({
  store,
  onNavigateToProject,
  onCreateProject,
}: {
  store: any;
  onNavigateToProject: (projectId: string) => void;
  onCreateProject?: (programId: string) => void;
}) {
  const {
    activeProgram,
    workspacePrograms,
    projectsInActiveProgram,
    workspaceProjects,
    allWorkspaceTasks,
    workspaceMembers,
    isAdmin,
    deleteProgram,
    updateProgram,
    updateProgramAssignees,
    activeWorkspace,
    workspaceTimezone,
  } = store;
  const { toast } = useToast();
  const timeZone = resolveWorkspaceTimezone(workspaceTimezone || activeWorkspace?.timezone);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moveToId, setMoveToId] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [assigneesOpen, setAssigneesOpen] = useState(false);

  const programProjects = projectsInActiveProgram || [];
  const programIds = useMemo(
    () => new Set(programProjects.map((p: any) => p.id)),
    [programProjects]
  );

  const stats = useMemo(() => {
    const tasks = (allWorkspaceTasks || []).filter((t: any) => programIds.has(t.projectId));
    const now = new Date();
    const todayKey = getDateKeyInTimeZone(now, timeZone);
    const open = tasks.filter((t: any) => !isTaskClosed(t, workspaceProjects));
    const done = tasks.filter((t: any) => isTaskClosed(t, workspaceProjects)).length;
    const overdue = open.filter(
      (t: any) => t.dueDate && new Date(t.dueDate) < now
    ).length;
    const urgent = open.filter((t: any) => t.priority === 'urgent').length;
    const dueToday = open.filter(
      (t: any) => t.dueDate && String(t.dueDate).slice(0, 10) === todayKey
    ).length;
    const completionRate = tasks.length > 0 ? (done / tasks.length) * 100 : 0;
    return {
      projects: programProjects.length,
      tasks: tasks.length,
      open: open.length,
      done,
      overdue,
      urgent,
      dueToday,
      completionRate,
      critical: overdue + urgent,
    };
  }, [allWorkspaceTasks, programIds, programProjects.length, workspaceProjects, timeZone]);

  const otherPrograms = useMemo(
    () => (workspacePrograms || []).filter((p: any) => p.id !== activeProgram?.id),
    [workspacePrograms, activeProgram?.id]
  );

  const assignedMembers = useMemo(() => {
    const ids = new Set(activeProgram?.assigneeUserIds || []);
    if (activeProgram?.createdByUserId) ids.add(activeProgram.createdByUserId);
    return (workspaceMembers || []).filter((m: any) => ids.has(m.userId));
  }, [activeProgram, workspaceMembers]);

  const handleToggleAssignee = (userId: string) => {
    if (!activeProgram || !isAdmin) return;
    const member = (workspaceMembers || []).find((m: any) => m.userId === userId);
    const isSystemAdmin = member?.role === 'owner' || member?.role === 'lead';
    const isCreator = Boolean(
      activeProgram.createdByUserId && userId === activeProgram.createdByUserId
    );
    if (isSystemAdmin || isCreator) return;
    const current: string[] = activeProgram.assigneeUserIds || [];
    const next = current.includes(userId)
      ? current.filter((id: string) => id !== userId)
      : [...current, userId];
    updateProgramAssignees(activeProgram.id, next);
  };

  if (!activeProgram) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-border/70 py-16 text-center">
        <Layers className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm font-medium">No program selected</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a program from the sidebar to view its dashboard.
        </p>
      </div>
    );
  }

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteProgram(activeProgram.id, {
        moveProjectsTo: programProjects.length > 0 ? moveToId : null,
      });
      toast({ title: 'Program deleted', description: `${activeProgram.name} was removed.` });
      setDeleteOpen(false);
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Could not delete program',
        description: e?.message,
      });
    } finally {
      setDeleting(false);
    }
  };

  const saveName = async () => {
    const next = nameDraft.trim();
    if (!next || next === activeProgram.name) {
      setEditingName(false);
      return;
    }
    try {
      await updateProgram(activeProgram.id, { name: next });
      toast({ title: 'Program renamed' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Could not rename', description: e?.message });
    } finally {
      setEditingName(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
            <Layers className="h-3.5 w-3.5" style={{ color: activeProgram.color }} />
            Program dashboard
          </div>
          {editingName && isAdmin ? (
            <div className="flex items-center gap-2">
              <input
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-2xl font-semibold tracking-tight outline-none focus:ring-2 focus:ring-ring/30"
                value={nameDraft}
                autoFocus
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={() => void saveName()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void saveName();
                  if (e.key === 'Escape') setEditingName(false);
                }}
              />
            </div>
          ) : (
            <h2
              className={cn(
                'text-2xl font-semibold tracking-tight',
                isAdmin && 'cursor-text hover:opacity-80'
              )}
              title={isAdmin ? 'Click to rename' : undefined}
              onClick={() => {
                if (!isAdmin) return;
                setNameDraft(activeProgram.name);
                setEditingName(true);
              }}
            >
              {activeProgram.name}
            </h2>
          )}
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {activeProgram.description ||
              'Projects and tasks under this program. Create projects here to keep work grouped.'}
          </p>
          {assignedMembers.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Assigned</span>
              <div className="flex -space-x-2">
                {assignedMembers.slice(0, 6).map((m: any) => (
                  <Avatar key={m.userId} className="h-7 w-7 border-2 border-background" title={m.displayName}>
                    <AvatarImage src={m.avatarUrl || undefined} />
                    <AvatarFallback className="text-[10px]">
                      {(m.displayName || '?').charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              {assignedMembers.length > 6 && (
                <span className="text-xs text-muted-foreground">+{assignedMembers.length - 6}</span>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <>
              <Dialog open={assigneesOpen} onOpenChange={setAssigneesOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-1.5">
                    <Users className="h-4 w-4" />
                    Assign
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[420px]">
                  <DialogHeader>
                    <DialogTitle>Assign program</DialogTitle>
                    <DialogDescription>
                      Choose who owns or leads this program. Assigned members show on the main dashboard workload.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="max-h-[400px] space-y-2 overflow-y-auto py-2">
                    {(workspaceMembers || []).map((m: any) => {
                      const isSystemAdmin = m.role === 'owner' || m.role === 'lead';
                      const isCreator = Boolean(
                        activeProgram.createdByUserId &&
                          m.userId === activeProgram.createdByUserId
                      );
                      const locked = isSystemAdmin || isCreator;
                      const assigned =
                        locked ||
                        (activeProgram.assigneeUserIds || []).includes(m.userId);
                      return (
                        <div
                          key={m.userId}
                          className="flex items-center justify-between rounded-xl p-2.5 transition-colors hover:bg-muted/50"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={m.avatarUrl || undefined} />
                              <AvatarFallback>{m.displayName?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex min-w-0 flex-col">
                              <span className="truncate text-sm font-medium">{m.displayName}</span>
                              <span className="text-[10px] uppercase text-muted-foreground">
                                {isCreator ? 'creator' : isSystemAdmin ? 'admin' : 'member'}
                              </span>
                            </div>
                          </div>
                          <Checkbox
                            checked={assigned}
                            disabled={locked}
                            onCheckedChange={() => handleToggleAssignee(m.userId)}
                          />
                        </div>
                      );
                    })}
                    {(workspaceMembers || []).length === 0 && (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        No workspace members yet.
                      </p>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={() => onCreateProject?.(activeProgram.id)}
              >
                <Plus className="h-4 w-4" />
                Add project
              </Button>
              <Button
                variant="outline"
                className="gap-1.5 text-destructive hover:text-destructive"
                onClick={() => {
                  setMoveToId(otherPrograms[0]?.id || '');
                  setDeleteOpen(true);
                }}
                disabled={(workspacePrograms || []).length <= 1}
                title={
                  (workspacePrograms || []).length <= 1
                    ? 'Keep at least one program'
                    : 'Delete program'
                }
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiTile
          label="Projects"
          value={stats.projects}
          hint="In this program"
          icon={FolderKanban}
          tone="blue"
        />
        <KpiTile
          label="Tasks"
          value={stats.tasks}
          hint={`${Math.round(stats.completionRate)}% complete`}
          icon={ListTodo}
          tone="slate"
        />
        <KpiTile
          label="Open"
          value={stats.open}
          hint={`${stats.dueToday} due today`}
          icon={CheckCircle2}
          tone="emerald"
        />
        <KpiTile
          label="Critical"
          value={stats.critical}
          hint={`${stats.overdue} overdue · ${stats.urgent} urgent`}
          icon={AlertCircle}
          tone={stats.critical > 0 ? 'rose' : 'slate'}
        />
      </div>

      <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Projects in {activeProgram.name}</h3>
            <p className="text-xs text-muted-foreground">Open a project to manage tasks and subtasks.</p>
          </div>
          <Badge variant="secondary">{stats.projects}</Badge>
        </div>

        {programProjects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 py-12 text-center">
            <Box className="mx-auto mb-3 h-9 w-9 text-muted-foreground/50" />
            <p className="text-sm font-medium">No projects in this program yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a project to start creating tasks.
            </p>
            {isAdmin && (
              <Button
                className="mt-4 gap-1.5"
                onClick={() => onCreateProject?.(activeProgram.id)}
              >
                <Plus className="h-4 w-4" />
                Create project
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {programProjects.map((p: any) => {
              const projectTasks = (allWorkspaceTasks || []).filter(
                (t: any) => t.projectId === p.id
              );
              const done = projectTasks.filter((t: any) =>
                isTaskClosed(t, workspaceProjects)
              ).length;
              const rate =
                projectTasks.length > 0 ? (done / projectTasks.length) * 100 : 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onNavigateToProject(p.id)}
                  className="rounded-2xl border border-border/60 bg-background p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-border hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="mt-0.5 grid h-9 w-9 place-items-center rounded-xl"
                      style={{ backgroundColor: `${p.color}22` }}
                    >
                      <Box className="h-4 w-4" style={{ color: p.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{p.name}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {p.description || 'No description'}
                      </p>
                      <div className="mt-3">
                        <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>
                            {done}/{projectTasks.length} tasks done
                          </span>
                          <span>{Math.round(rate)}%</span>
                        </div>
                        <Progress value={rate} className="h-1.5" />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete program “{activeProgram.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {programProjects.length > 0
                ? `This program has ${programProjects.length} project${programProjects.length === 1 ? '' : 's'}. Choose another program to move them into before deleting.`
                : 'This permanently removes the program. This cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {programProjects.length > 0 && (
            <div className="space-y-2 py-1">
              <p className="text-sm font-medium">Move projects to</p>
              <Select value={moveToId} onValueChange={setMoveToId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select program" />
                </SelectTrigger>
                <SelectContent>
                  {otherPrograms.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting || (programProjects.length > 0 && !moveToId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                'Delete program'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
