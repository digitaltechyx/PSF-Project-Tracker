
"use client";

import React, { useState } from 'react';
import { TaskList } from '../tasks/TaskList';
import { TaskDetailPanel } from '../tasks/TaskDetailPanel';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ListTodo, CheckSquare, Loader2 } from 'lucide-react';

export function MyTasksView({ store }: { store: any }) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const { myTasks, isTasksLoading, updateTask } = store;

  const stats = {
    todo: myTasks.filter((t: any) => t.status === 'todo').length,
    inProgress: myTasks.filter((t: any) => t.status === 'in_progress').length,
    done: myTasks.filter((t: any) => t.status === 'done').length,
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <ListTodo className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold font-headline">My Tasks</h2>
              {isTasksLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <p className="text-sm text-muted-foreground">Everything assigned to you in {store.activeWorkspace?.name}.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">To Do</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.todo}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-accent">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-500">{stats.done}</div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-card rounded-xl border-none shadow-sm overflow-hidden min-h-[400px]">
        {myTasks.length > 0 ? (
          <TaskList 
            tasks={myTasks} 
            onTaskClick={(id) => setSelectedTaskId(id)} 
            updateTask={updateTask}
          />
        ) : isTasksLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
            <p className="text-muted-foreground animate-pulse">Checking your taskboard...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="h-20 w-20 bg-muted/50 rounded-full flex items-center justify-center">
              <CheckSquare className="h-10 w-10 text-muted-foreground opacity-20" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">No tasks assigned to you</h3>
              <p className="text-muted-foreground max-w-xs mx-auto">
                Sit back and relax, or check with your team if there's anything you can help with!
              </p>
            </div>
          </div>
        )}
      </div>

      {selectedTaskId && (
        <TaskDetailPanel 
          taskId={selectedTaskId} 
          isOpen={!!selectedTaskId} 
          onClose={() => setSelectedTaskId(null)} 
          store={store}
        />
      )}
    </div>
  );
}
