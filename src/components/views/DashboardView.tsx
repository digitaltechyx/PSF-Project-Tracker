
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  FolderKanban, 
  CheckCircle2, 
  Clock, 
  PauseCircle,
  AlertCircle,
  CalendarDays,
  Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { TodayCard } from '@/components/dashboard/TodayCard';
import { TimeTrackingWidget } from '@/components/dashboard/TimeTrackingWidget';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';

export function DashboardView({
  store,
  onNavigateToProject,
  onNavigateToTask,
}: {
  store: any;
  onNavigateToProject: (id: string) => void;
  onNavigateToTask?: (wsId: string, projId: string, taskId: string) => void;
}) {
  const { allWorkspaceTasks, workspaceProjects, activeWorkspace, isTasksLoading } = store;
  const [mounted, setMounted] = useState(false);
  const selectedTaskId = store.selectedTaskId as string | null;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Stats derived from raw unfiltered data
  const stats = useMemo(() => {
    const tasks = allWorkspaceTasks || [];
    const now = new Date();
    return {
      totalProjects: workspaceProjects.length,
      totalTasks: tasks.length,
      doneTasks: tasks.filter((t: any) => t.status === 'done').length,
      inProgress: tasks.filter((t: any) => t.status === 'in_progress').length,
      todo: tasks.filter((t: any) => t.status === 'todo').length,
      onHold: tasks.filter((t: any) => t.status === 'on_hold').length,
      overdue: tasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'done').length,
      urgent: tasks.filter((t: any) => t.priority === 'urgent').length,
    };
  }, [allWorkspaceTasks, workspaceProjects.length]);

  const completionRate = stats.totalTasks > 0 ? (stats.doneTasks / stats.totalTasks) * 100 : 0;

  // Sorted list for recent activity
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
        </p>
      </div>

      <TimeTrackingWidget store={store} />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="bg-card/80 shadow-sm border border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 py-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">Projects</CardTitle>
            <FolderKanban className="h-4 w-4 text-primary/80" />
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <div className="text-xl font-bold">{stats.totalProjects}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 shadow-sm border border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 py-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">Tasks</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <div className="text-xl font-bold">{stats.totalTasks}</div>
            <Progress value={completionRate} className="h-1 mt-2" />
            <p className="text-[10px] text-muted-foreground mt-1">{mounted ? Math.round(completionRate) : 0}% done</p>
          </CardContent>
        </Card>
        <Card className="bg-card/80 shadow-sm border border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 py-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">Active</CardTitle>
            <CalendarDays className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <div className="text-xl font-bold">{stats.todo + stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 shadow-sm border border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 py-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">On hold</CardTitle>
            <PauseCircle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <div className="text-xl font-bold">{stats.onHold}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 shadow-sm border border-border/50 col-span-2 md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 py-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">Critical</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <div className="text-xl font-bold">{mounted ? stats.overdue + stats.urgent : '—'}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="shadow-sm border border-border/50 lg:col-span-2">
          <CardHeader className="flex items-center justify-between flex-row">
            <CardTitle className="text-base font-semibold">Recent updates</CardTitle>
            {isTasksLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {recentTasks.map((task: any) => (
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
                    {task.status === 'done' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : task.status === 'in_progress' ? (
                      <Clock className="h-5 w-5 text-accent" />
                    ) : task.status === 'on_hold' ? (
                      <PauseCircle className="h-5 w-5 text-amber-600" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-semibold group-hover:text-primary transition-colors">{task.title}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] uppercase font-bold py-0 h-4">
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
              ))}
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
                const done = projectTasks.filter((t: any) => t.status === 'done').length;
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
