"use client";

import React, { useMemo } from 'react';
import { TaskList } from '../tasks/TaskList';
import { TaskDetailPanel } from '../tasks/TaskDetailPanel';
import { Card, CardContent } from '@/components/ui/card';
import { CheckSquare, Loader2, Circle, CheckCircle2, ListTodo } from 'lucide-react';
import { isTaskClosed } from '@/lib/pipelines';

export function MyTasksView({ store }: { store: any }) {
  const { myTasks, isTasksLoading, updateTask, openTask, closeTask, selectedTaskId, workspaceProjects } =
    store;

  const visibleTasks = useMemo(() => {
    const q = (store.globalSearchQuery || '').trim().toLowerCase();
    if (!q) return myTasks;

    return (myTasks || []).filter((t: any) => {
      const title = (t.title || '').toLowerCase();
      const tags = (t.tags || []).map((x: string) => x.toLowerCase());
      return title.includes(q) || tags.some((tag: string) => tag.includes(q));
    });
  }, [myTasks, store.globalSearchQuery]);

  const stats = useMemo(() => {
    const open = visibleTasks.filter((t: any) => !isTaskClosed(t, workspaceProjects));
    const done = visibleTasks.filter((t: any) => isTaskClosed(t, workspaceProjects));
    return {
      total: visibleTasks.length,
      open: open.length,
      done: done.length,
    };
  }, [visibleTasks, workspaceProjects]);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col gap-1">
        <p className="page-subheading flex items-center gap-2">
          Everything assigned to you in {store.activeWorkspace?.name}.
          {isTasksLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Assigned', value: stats.total, icon: ListTodo, color: 'text-primary' },
          { label: 'Open', value: stats.open, icon: Circle, color: 'text-slate-500' },
          { label: 'Completed', value: stats.done, icon: CheckCircle2, color: 'text-emerald-600' },
        ].map((s) => (
          <Card key={s.label} className="border-border/60 shadow-sm bg-card/80">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </p>
                <p className="text-2xl font-bold mt-1 tabular-nums">{s.value}</p>
              </div>
              <s.icon className={`h-5 w-5 ${s.color} opacity-80`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="min-h-[400px]">
        {visibleTasks.length > 0 ? (
          <TaskList
            tasks={visibleTasks}
            onTaskClick={(id) => openTask?.(id)}
            updateTask={updateTask}
            readOnly={false}
            subtasks={store.allWorkspaceSubtasks}
            workspaceMembers={store.workspaceMembers}
            currentUser={store.currentUser}
            workspaceProjects={workspaceProjects}
          />
        ) : isTasksLoading ? (
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm flex flex-col items-center justify-center py-20 text-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary opacity-30" />
            <p className="text-muted-foreground animate-pulse">Loading your tasks…</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="h-16 w-16 bg-muted/60 rounded-2xl flex items-center justify-center">
              <CheckSquare className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">No tasks assigned to you</h3>
              <p className="text-muted-foreground max-w-sm mx-auto text-sm mt-1">
                {store.globalSearchQuery?.trim()
                  ? `No matching tasks for "${store.globalSearchQuery}".`
                  : 'Tasks assigned to you in this workspace will show up here.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          isOpen={!!selectedTaskId}
          onClose={() => closeTask?.()}
          store={store}
        />
      )}
    </div>
  );
}
