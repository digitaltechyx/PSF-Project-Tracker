"use client";

import React from 'react';
import { Task, Status, Priority } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { MoreHorizontal, Plus, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const columns: { id: Status, title: string, color: string }[] = [
  { id: 'todo', title: 'To Do', color: 'bg-slate-200' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-accent/20' },
  { id: 'done', title: 'Done', color: 'bg-green-100' },
];

const priorityBorder: Record<Priority, string> = {
  low: 'border-l-slate-400',
  medium: 'border-l-blue-400',
  high: 'border-l-orange-400',
  urgent: 'border-l-red-500',
};

export function KanbanBoard({ 
  tasks, 
  onTaskClick, 
  updateTask 
}: { 
  tasks: Task[], 
  onTaskClick: (id: string) => void,
  updateTask: any
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full min-h-[500px]">
      {columns.map(col => {
        const columnTasks = tasks.filter(t => t.status === col.id);
        
        return (
          <div key={col.id} className="flex flex-col gap-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", col.color)} />
                  {col.title}
                </h3>
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{columnTasks.length}</Badge>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7"><Plus className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
              </div>
            </div>

            <div className="flex-1 space-y-3 bg-muted/30 p-2 rounded-xl min-h-[150px]">
              {columnTasks.map(task => (
                <Card 
                  key={task.id} 
                  className={cn(
                    "cursor-pointer hover:shadow-md transition-shadow border-none border-l-4 shadow-sm",
                    priorityBorder[task.priority]
                  )}
                  onClick={() => onTaskClick(task.id)}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <span className={cn(
                        "text-sm font-semibold leading-tight",
                        task.status === 'done' && "text-muted-foreground line-through"
                      )}>
                        {task.title}
                      </span>
                    </div>
                    
                    {task.tags && task.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {task.tags.map(tag => (
                          <span key={tag} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-medium">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
                        {task.dueDate && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </div>
                        )}
                      </div>
                      <div className="flex -space-x-2">
                        <div className="w-5 h-5 rounded-full bg-primary/10 border-2 border-background" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {columnTasks.length === 0 && (
                <div className="h-24 flex items-center justify-center border-2 border-dashed rounded-xl text-xs text-muted-foreground/50">
                  Drop tasks here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}