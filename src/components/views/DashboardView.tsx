
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

export function DashboardView({ store, onNavigateToProject }: { store: any, onNavigateToProject: (id: string) => void }) {
  const { allWorkspaceTasks, workspaceProjects, activeWorkspace, isTasksLoading } = store;
  const [mounted, setMounted] = useState(false);

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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-card shadow-sm border-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Projects</CardTitle>
            <FolderKanban className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProjects}</div>
            <p className="text-xs text-muted-foreground mt-1 truncate">In {activeWorkspace.name}</p>
          </CardContent>
        </Card>
        <Card className="bg-card shadow-sm border-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTasks}</div>
            <div className="mt-2">
              <Progress value={completionRate} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground mt-1">
                {mounted ? Math.round(completionRate) : '0'}% completed
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card shadow-sm border-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Planned Tasks</CardTitle>
            <CalendarDays className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todo + stats.inProgress}</div>
            <p className="text-xs text-muted-foreground mt-1">Needs attention</p>
          </CardContent>
        </Card>
        <Card className="bg-card shadow-sm border-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">On Hold Tasks</CardTitle>
            <PauseCircle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.onHold}</div>
            <p className="text-xs text-muted-foreground mt-1">Paused items</p>
          </CardContent>
        </Card>
        <Card className="bg-card shadow-sm border-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mounted ? stats.overdue + stats.urgent : '...'}</div>
            <p className="text-xs text-muted-foreground mt-1">Overdue or Urgent</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm border-none">
          <CardHeader className="flex items-center justify-between flex-row">
            <CardTitle className="text-lg">Recent Activity</CardTitle>
            {isTasksLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {recentTasks.map((task: any) => (
                <div key={task.id} className="flex items-start gap-4 group">
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
                    <p className="text-sm font-semibold group-hover:text-primary transition-colors cursor-pointer">{task.title}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] uppercase font-bold py-0 h-4">
                        {task.priority}
                      </Badge>
                      <span className="text-xs text-muted-foreground">in project</span>
                      <span 
                        className="text-xs font-medium underline cursor-pointer hover:text-primary transition-colors"
                        onClick={() => onNavigateToProject(task.projectId)}
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

        <Card className="shadow-sm border-none">
          <CardHeader>
            <CardTitle className="text-lg">Projects Breakdown</CardTitle>
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
    </div>
  );
}
