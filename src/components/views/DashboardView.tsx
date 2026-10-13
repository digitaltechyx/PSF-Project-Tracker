
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  CheckCircle2, 
  Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { TodayCard } from '@/components/dashboard/TodayCard';
import { TimeTrackingWidget } from '@/components/dashboard/TimeTrackingWidget';
import { DashboardKpiScoreboard } from '@/components/dashboard/DashboardKpiScoreboard';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';
import { getTaskPipelineInfo, isTaskClosed } from '@/lib/pipelines';
import { getDateKeyInTimeZone, resolveWorkspaceTimezone } from '@/lib/timezone';
import type { Target, TargetStatus } from '@/lib/types';

function isTargetClosed(status?: TargetStatus | string) {
  return status === 'complete' || status === 'cancelled' || status === 'done';
}

function targetStatusLabel(status?: TargetStatus | string) {
  if (!status) return 'Planned';
  if (status === 'done') return 'Complete';
  return status.replace(/_/g, ' ');
}

function targetStatusClass(status?: TargetStatus | string) {
  switch (status) {
    case 'complete':
    case 'done':
      return 'bg-emerald-100 text-emerald-800';
    case 'in_progress':
      return 'bg-blue-100 text-blue-800';
    case 'hold':
      return 'bg-amber-100 text-amber-900';
    case 'cancelled':
      return 'bg-slate-200 text-slate-700';
    default:
      return 'bg-violet-100 text-violet-800';
  }
}

export function DashboardView({
  store,
  onNavigateToProject,
  onNavigateToTask,
  onNavigateToTargets,
}: {
  store: any;
  onNavigateToProject: (id: string) => void;
  onNavigateToTask?: (wsId: string, projId: string, taskId: string) => void;
  onNavigateToTargets?: () => void;
}) {
  const {
    allWorkspaceTasks,
    workspaceProjects,
    workspaceTargets,
    canAccessTargets,
    activeWorkspace,
    workspaceTimezone,
    isTasksLoading,
  } = store;
  const [mounted, setMounted] = useState(false);
  const selectedTaskId = store.selectedTaskId as string | null;
  const timeZone = resolveWorkspaceTimezone(workspaceTimezone || activeWorkspace?.timezone);

  useEffect(() => {
    setMounted(true);
  }, []);

  const stats = useMemo(() => {
    const tasks = allWorkspaceTasks || [];
    const now = new Date();
    const todayKey = getDateKeyInTimeZone(now, timeZone);
    const openTasks = tasks.filter((t: any) => !isTaskClosed(t, workspaceProjects));
    const doneTasks = tasks.filter((t: any) => isTaskClosed(t, workspaceProjects)).length;
    const dueToday = openTasks.filter((t: any) => {
      if (!t.dueDate) return false;
      return String(t.dueDate).slice(0, 10) === todayKey;
    }).length;
    return {
      totalProjects: workspaceProjects.length,
      totalTasks: tasks.length,
      doneTasks,
      active: openTasks.length,
      dueToday,
      overdue: tasks.filter(
        (t: any) => t.dueDate && new Date(t.dueDate) < now && !isTaskClosed(t, workspaceProjects)
      ).length,
      urgent: tasks.filter((t: any) => t.priority === 'urgent' && !isTaskClosed(t, workspaceProjects)).length,
    };
  }, [allWorkspaceTasks, workspaceProjects, timeZone]);

  const targetStats = useMemo(() => {
    const targets: Target[] = workspaceTargets || [];
    const todayKey = getDateKeyInTimeZone(new Date(), timeZone);
    const monthKey = todayKey.slice(0, 7); // YYYY-MM

    const open = targets.filter((t) => !isTargetClosed(t.status));
    const dueThisMonth = open.filter((t) => {
      if (!t.endDate) return false;
      return t.endDate.slice(0, 7) === monthKey;
    });
    const overdue = open.filter((t) => t.endDate && t.endDate < todayKey);
    const completed = targets.filter((t) => isTargetClosed(t.status) && t.status !== 'cancelled').length;
    const completionRate = targets.length > 0 ? (completed / targets.length) * 100 : 0;

    return {
      total: targets.length,
      open: open.length,
      dueThisMonth: dueThisMonth.length,
      overdue: overdue.length,
      completed,
      completionRate,
      dueThisMonthList: [...dueThisMonth].sort((a, b) =>
        String(a.endDate || '').localeCompare(String(b.endDate || ''))
      ),
      upcoming: [...open]
        .filter((t) => t.endDate)
        .sort((a, b) => String(a.endDate || '').localeCompare(String(b.endDate || '')))
        .slice(0, 5),
    };
  }, [workspaceTargets, timeZone]);

  const completionRate = stats.totalTasks > 0 ? (stats.doneTasks / stats.totalTasks) * 100 : 0;

  const recentTasks = useMemo(() => {
    return [...allWorkspaceTasks].sort((a: any, b: any) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    ).slice(0, 5);
  }, [allWorkspaceTasks]);

  if (isTasksLoading && !allWorkspaceTasks.length) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <Card key={i} className="border-none shadow-sm">
              <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-12" /></CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border-none shadow-sm h-[400px]"><CardContent /></Card>
          <Card className="border-none shadow-sm h-[400px]"><CardContent /></Card>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">
          Good {mounted && new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}
          {store.currentUser?.name ? `, ${store.currentUser.name.split(' ')[0]}` : ''}
        </h2>
        <p className="text-sm text-muted-foreground">
          {activeWorkspace?.name} · {stats.totalTasks} tasks across {stats.totalProjects} projects
          {canAccessTargets ? ` · ${targetStats.total} targets` : ''}
        </p>
      </div>

      <TimeTrackingWidget store={store} />

      <DashboardKpiScoreboard
        workspaceName={activeWorkspace?.name}
        showTargets={!!canAccessTargets}
        delivery={{
          projects: stats.totalProjects,
          tasks: stats.totalTasks,
          open: stats.active,
          done: stats.doneTasks,
          completionRate,
          overdue: stats.overdue,
          urgent: stats.urgent,
          dueToday: stats.dueToday,
        }}
        targets={
          canAccessTargets
            ? {
                total: targetStats.total,
                open: targetStats.open,
                dueThisMonth: targetStats.dueThisMonth,
                overdue: targetStats.overdue,
                completed: targetStats.completed,
                completionRate: targetStats.completionRate,
              }
            : undefined
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="shadow-sm border border-border/50 lg:col-span-2">
          <CardHeader className="flex items-center justify-between flex-row">
            <CardTitle className="text-base font-semibold">Recent updates</CardTitle>
            {isTasksLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {recentTasks.map((task: any) => {
                const pipeline = getTaskPipelineInfo(task, workspaceProjects);
                const closed = isTaskClosed(task, workspaceProjects);
                return (
                <div
                  key={task.id}
                  className="flex items-start gap-4 group cursor-pointer"
                  onClick={() => {
                    if (onNavigateToTask) {
                      onNavigateToTask(task.workspaceId, task.projectId, task.id);
                    } else {
                      store.openTask?.(task.id);
                    }
                  }}
                >
                  <div className="mt-1">
                    {closed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <span
                        className="mt-0.5 block h-3 w-3 rounded-full ring-2 ring-background"
                        style={{ backgroundColor: pipeline.color || '#94a3b8' }}
                      />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-semibold group-hover:text-primary transition-colors">{task.title}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-[10px] gap-1.5 font-medium py-0 h-5">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: pipeline.color }}
                        />
                        {pipeline.name}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] uppercase font-bold py-0 h-5">
                        {task.priority}
                      </Badge>
                      <span className="text-xs text-muted-foreground">in</span>
                      <span 
                        className="text-xs font-medium underline hover:text-primary transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToProject(task.projectId);
                        }}
                      >
                        {workspaceProjects.find((p: any) => p.id === task.projectId)?.name || 'Unknown Project'}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {mounted ? new Date(task.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '...'}
                  </div>
                </div>
              );
              })}
              {allWorkspaceTasks.length === 0 && (
                <div className="text-center py-10 text-muted-foreground space-y-2">
                  <p>No tasks found in this workspace.</p>
                  <p className="text-xs">Create a project and add your first task to see activity here.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <TodayCard store={store} onTaskClick={(id: string) => store.openTask?.(id)} />

        <Card className="shadow-sm border border-border/50">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {workspaceProjects.map((project: any) => {
                const projectTasks = allWorkspaceTasks.filter((t: any) => t.projectId === project.id);
                const done = projectTasks.filter((t: any) => isTaskClosed(t, workspaceProjects)).length;
                const total = projectTasks.length;
                const progress = total > 0 ? (done / total) * 100 : 0;
                
                return (
                  <div 
                    key={project.id} 
                    className="space-y-2 cursor-pointer group"
                    onClick={() => onNavigateToProject(project.id)}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium group-hover:text-primary transition-colors">{project.name}</span>
                      <span className="text-xs text-muted-foreground">{done}/{total}</span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                  </div>
                );
              })}
              {workspaceProjects.length === 0 && (
                <div className="text-center py-6 text-sm text-muted-foreground italic">
                  No projects created yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {canAccessTargets && (
          <Card className="shadow-sm border border-border/50 lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base font-semibold">Targets</CardTitle>
                <p className="text-xs text-slate-600 mt-1">
                  {targetStats.dueThisMonth > 0
                    ? `${targetStats.dueThisMonth} due this month`
                    : 'No open targets due this month'}
                  {targetStats.overdue > 0 ? ` · ${targetStats.overdue} overdue` : ''}
                </p>
              </div>
              {onNavigateToTargets && (
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onNavigateToTargets}>
                  View all
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {(targetStats.dueThisMonthList.length > 0 ? targetStats.dueThisMonthList : targetStats.upcoming).length === 0 ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-slate-600">
                  No targets yet. Create goals on the Targets page.
                </div>
              ) : (
                <div className="space-y-3">
                  {(targetStats.dueThisMonthList.length > 0
                    ? targetStats.dueThisMonthList
                    : targetStats.upcoming
                  ).slice(0, 6).map((target) => {
                    const subs = target.subTargets || [];
                    const doneSubs = subs.filter((s) => isTargetClosed(s.status)).length;
                    const todayKey = getDateKeyInTimeZone(new Date(), timeZone);
                    const isOverdue = !isTargetClosed(target.status) && !!target.endDate && target.endDate < todayKey;
                    return (
                      <button
                        key={target.id}
                        type="button"
                        className="flex w-full items-start justify-between gap-3 rounded-xl border border-border bg-slate-50/80 px-3.5 py-3 text-left transition-colors hover:bg-slate-100"
                        onClick={() => onNavigateToTargets?.()}
                      >
                        <div className="min-w-0 space-y-1.5">
                          <p className="text-sm font-semibold text-foreground truncate">{target.title}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={`text-[10px] capitalize border-0 ${targetStatusClass(target.status)}`}>
                              {targetStatusLabel(target.status)}
                            </Badge>
                            {subs.length > 0 && (
                              <span className="text-[11px] text-slate-600">
                                {doneSubs}/{subs.length} sub-targets
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={`text-xs font-medium tabular-nums ${isOverdue ? 'text-destructive' : 'text-slate-700'}`}>
                            {target.endDate
                              ? new Date(`${target.endDate}T12:00:00`).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                })
                              : 'No end date'}
                          </p>
                          {isOverdue && <p className="text-[10px] text-destructive mt-0.5">Overdue</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {selectedTaskId && (
        <TaskDetailPanel 
          taskId={selectedTaskId} 
          isOpen={!!selectedTaskId} 
          onClose={() => store.closeTask?.()}
          store={store}
        />
      )}
    </div>
  );
}
