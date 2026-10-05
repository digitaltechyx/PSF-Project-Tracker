"use client";

import React, { useMemo } from 'react';
import { TaskList } from '../tasks/TaskList';
import { TaskDetailPanel } from '../tasks/TaskDetailPanel';
import { Card, CardContent } from '@/components/ui/card';
import { ListTodo, CheckSquare, Loader2, Circle, PauseCircle, CheckCircle2 } from 'lucide-react';

export function MyTasksView({ store }: { store: any }) {
  const { myTasks, isTasksLoading, updateTask, openTask, closeTask, selectedTaskId } = store;

  const visibleTasks = useMemo(() => {
    const q = (store.globalSearchQuery || '').trim().toLowerCase();
    if (!q) return myTasks;

    return (myTasks || []).filter((t: any) => {
      const title = (t.title || '').toLowerCase();
      const tags = (t.tags || []).map((x: string) => x.toLowerCase());
      return title.includes(q) || tags.some((tag: string) => tag.includes(q));
    });
  }, [myTasks, store.globalSearchQuery]);

  const stats = {
    todo: visibleTasks.filter((t: any) => t.status === 'todo').length,
    inProgress: visibleTasks.filter((t: any) => t.status === 'in_progress').length,
    onHold: visibleTasks.filter((t: any) => t.status === 'on_hold').length,
    done: visibleTasks.filter((t: any) => t.status === 'done').length,
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          My Tasks
          {isTasksLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </h2>
        <p className="text-sm text-muted-foreground">
          Everything assigned to you in {store.activeWorkspace?.name}.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'To Do', value: stats.todo, icon: Circle, color: 'text-slate-500' },
          { label: 'In Progress', value: stats.inProgress, icon: ListTodo, color: 'text-blue-600' },
          { label: 'On Hold', value: stats.onHold, icon: PauseCircle, color: 'text-amber-600' },
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
