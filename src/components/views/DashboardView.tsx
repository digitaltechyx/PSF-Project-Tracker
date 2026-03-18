"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  FolderKanban, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  TrendingUp,
  CalendarDays
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export function DashboardView({ store }: { store: any }) {
  const { workspaceTasks, workspaceProjects, activeWorkspace } = store;

  const stats = {
    totalProjects: workspaceProjects.length,
    totalTasks: workspaceTasks.length,
    doneTasks: workspaceTasks.filter((t: any) => t.status === 'done').length,
    inProgress: workspaceTasks.filter((t: any) => t.status === 'in_progress').length,
    todo: workspaceTasks.filter((t: any) => t.status === 'todo').length,
    overdue: workspaceTasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done').length,
    urgent: workspaceTasks.filter((t: any) => t.priority === 'urgent').length,
  };

  const completionRate = stats.totalTasks > 0 ? (stats.doneTasks / stats.totalTasks) * 100 : 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card shadow-sm border-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Projects</CardTitle>
            <FolderKanban className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProjects}</div>
            <p className="text-xs text-muted-foreground mt-1">In {activeWorkspace.name}</p>
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
              <p className="text-[10px] text-muted-foreground mt-1">{Math.round(completionRate)}% completed</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card shadow-sm border-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Upcoming Tasks</CardTitle>
            <CalendarDays className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todo + stats.inProgress}</div>
            <p className="text-xs text-muted-foreground mt-1">Needs attention</p>
          </CardContent>
        </Card>
        <Card className="bg-card shadow-sm border-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overdue + stats.urgent}</div>
            <p className="text-xs text-muted-foreground mt-1">Overdue or Urgent</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm border-none">
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {workspaceTasks.slice(0, 5).map((task: any) => (
                <div key={task.id} className="flex items-start gap-4">
                  <div className="mt-1">
                    {task.status === 'done' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : task.status === 'in_progress' ? (
                      <Clock className="h-5 w-5 text-accent" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-semibold">{task.title}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] uppercase font-bold py-0 h-4">
                        {task.priority}
                      </Badge>
                      <span className="text-xs text-muted-foreground">in project</span>
                      <span className="text-xs font-medium underline cursor-pointer">
                        {workspaceProjects.find((p: any) => p.id === task.projectId)?.name}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(task.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
              {workspaceTasks.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                  No tasks found in this workspace.
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
                const projectTasks = workspaceTasks.filter((t: any) => t.projectId === project.id);
                const done = projectTasks.filter((t: any) => t.status === 'done').length;
                const total = projectTasks.length;
                const progress = total > 0 ? (done / total) * 100 : 0;
                
                return (
                  <div key={project.id} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{project.name}</span>
                      <span className="text-xs text-muted-foreground">{done}/{total}</span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}