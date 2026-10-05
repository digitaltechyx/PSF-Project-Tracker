"use client";

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  CheckCircle2, 
  Calendar,
  Loader2
} from 'lucide-react';
import { getTaskPipelineInfo, isTaskClosed } from '@/lib/pipelines';

export function TodayCard({ store, onTaskClick }: { store: any, onTaskClick: (id: string) => void }) {
  const { allWorkspaceTasks, workspaceProjects, currentUser, isTasksLoading } = store;
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Filter tasks assigned to current user and due today
  const todayTasks = useMemo(() => {
    if (!currentUser?.id || !allWorkspaceTasks) return [];
    
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    
    return allWorkspaceTasks.filter((t: any) => {
      // Must be assigned to current user
      if (!t.assigneeUserIds?.includes(currentUser.id)) return false;
      
      // Must have a due date
      if (!t.dueDate) return false;
      
      // Must be due today (within local day boundaries)
      const dueDate = new Date(t.dueDate);
      return dueDate >= startOfDay && dueDate < endOfDay;
    }).slice(0, 5); // Limit to 5 tasks
  }, [allWorkspaceTasks, currentUser?.id]);

  const taskCount = todayTasks.length;

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="flex items-center justify-between flex-row">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <Calendar className="h-4 w-4" />
          </span>
          Today
        </CardTitle>
        {isTasksLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        {isTasksLoading && !mounted ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : taskCount === 0 ? (
          <div className="text-center py-10 text-muted-foreground rounded-xl border border-dashed border-border/70 bg-muted/20">
            <Calendar className="mx-auto mb-2 h-6 w-6 opacity-30" />
            <p className="text-sm font-medium">Your schedule is clear</p>
            <p className="mt-1 text-xs">No tasks are due today.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground mb-2">
              {taskCount} task{taskCount !== 1 ? 's' : ''} due today
            </div>
            {todayTasks.map((task: any) => {
              const pipeline = getTaskPipelineInfo(task, workspaceProjects);
              const closed = isTaskClosed(task, workspaceProjects);
              return (
              <div 
                key={task.id} 
                className="flex items-start gap-3 group cursor-pointer hover:bg-muted/50 p-2.5 rounded-xl border border-transparent hover:border-border/60 transition-all"
                onClick={() => onTaskClick(task.id)}
              >
                <div className="mt-0.5">
                  {closed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <span
                      className="mt-0.5 block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: pipeline.color || '#94a3b8' }}
                    />
                  )}
                </div>
                <div className="flex-1 space-y-1 min-w-0">
                  <p className="text-sm font-medium group-hover:text-primary transition-colors truncate">
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] gap-1 font-medium py-0 h-4">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: pipeline.color }}
                      />
                      {pipeline.name}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] uppercase font-bold py-0 h-4">
                      {task.priority}
                    </Badge>
                    <span className="text-xs text-muted-foreground truncate">
                      {workspaceProjects.find((p: any) => p.id === task.projectId)?.name || 'Unknown Project'}
                    </span>
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
