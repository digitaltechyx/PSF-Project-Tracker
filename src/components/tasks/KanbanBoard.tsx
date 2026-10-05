"use client";

import React, { useEffect, useState } from 'react';
import { Task, Priority, Pipeline, Status } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Plus, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  getClosedStatusId,
  getPipelineInfo,
  isClosedStatus,
} from '@/lib/pipelines';

const priorityAccent: Record<Priority, string> = {
  low: 'bg-slate-400',
  medium: 'bg-blue-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
};

export function KanbanBoard({
  tasks,
  pipelines,
  onTaskClick,
  updateTask,
  onAddTask,
  onAddStatus,
  canManageStatuses = false,
  readOnly = false,
  subtasks = [],
  workspaceMembers = [],
  currentUser = null,
}: {
  tasks: Task[];
  pipelines: Pipeline[];
  onTaskClick: (id: string) => void;
  updateTask: (id: string, data: Partial<Task>) => void;
  onAddTask?: (status: Status) => void;
  onAddStatus?: () => void;
  canManageStatuses?: boolean;
  readOnly?: boolean;
  subtasks?: any[];
  workspaceMembers?: any[];
  currentUser?: any;
}) {
  const [mounted, setMounted] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [activeColumn, setActiveColumn] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const closedId = getClosedStatusId(pipelines);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (readOnly) return;
    setDraggedTaskId(id);
    e.dataTransfer.setData('text', id);
    e.dataTransfer.effectAllowed = 'move';
    (e.currentTarget as HTMLElement).style.opacity = '0.45';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedTaskId(null);
    setActiveColumn(null);
    (e.currentTarget as HTMLElement).style.opacity = '1';
  };

  const handleDragOver = (e: React.DragEvent, status: string) => {
    if (readOnly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (activeColumn !== status) setActiveColumn(status);
  };

  const handleDrop = (e: React.DragEvent, status: string) => {
    if (readOnly) return;
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text');
    if (taskId) updateTask(taskId, { status });
    setDraggedTaskId(null);
    setActiveColumn(null);
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1 min-h-[560px] snap-x">
      {pipelines.map((col) => {
        const columnTasks = tasks.filter((t) => t.status === col.id);
        const color = col.color || '#94a3b8';
        const isActive = activeColumn === col.id;

        return (
          <div
            key={col.id}
            className="flex flex-col w-[280px] min-w-[280px] snap-start shrink-0"
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDragEnter={(e) => {
              e.preventDefault();
              if (!readOnly) setActiveColumn(col.id);
            }}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            <div
              className="rounded-t-xl px-3 pt-3 pb-2 border border-b-0 bg-card/90 backdrop-blur-sm"
              style={{ borderTopColor: color, borderTopWidth: 3 }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-white shadow-sm"
                    style={{ backgroundColor: color }}
                  />
                  <h3 className="text-sm font-semibold truncate text-foreground">{col.name}</h3>
                  <Badge
                    variant="secondary"
                    className="h-5 min-w-[1.25rem] justify-center px-1.5 text-[10px] font-semibold tabular-nums"
                  >
                    {columnTasks.length}
                  </Badge>
                </div>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => onAddTask?.(col.id)}
                    title="Add task"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div
              className={cn(
                'flex-1 space-y-2.5 p-2 rounded-b-xl border border-t-0 bg-muted/25 min-h-[480px] transition-all duration-200',
                isActive && 'bg-primary/5 ring-2 ring-primary/20 ring-inset'
              )}
            >
              {columnTasks.map((task) => {
                const taskSubtasks = (subtasks || []).filter((s) => s.taskId === task.id);
                const subDone = taskSubtasks.filter((s) => s.status === closedId).length;
                const done = isClosedStatus(pipelines, task.status);

                return (
                  <div
                    key={task.id}
                    draggable={!readOnly}
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onTaskClick(task.id)}
                    className={cn(
                      'group relative rounded-xl border border-border/60 bg-card p-3.5 shadow-sm',
                      'hover:shadow-md hover:border-border cursor-grab active:cursor-grabbing transition-all',
                      draggedTaskId === task.id && 'opacity-30 scale-[0.98]',
                      readOnly && 'cursor-pointer'
                    )}
                  >
                    <div
                      className={cn('absolute left-0 top-3 bottom-3 w-1 rounded-full', priorityAccent[task.priority])}
                    />
                    <div className="pl-2 space-y-2.5">
                      <p
                        className={cn(
                          'text-sm font-semibold leading-snug text-foreground',
                          done && 'line-through text-muted-foreground'
                        )}
                      >
                        {task.title}
                      </p>

                      {task.tags && task.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {task.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {taskSubtasks.length > 0 && (
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>
                            {subDone}/{taskSubtasks.length}
                          </span>
                          <Progress value={(subDone / taskSubtasks.length) * 100} className="h-1 flex-1 max-w-[64px]" />
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-0.5">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                          {mounted && task.dueDate ? (
                            <>
                              <Clock className="h-3 w-3" />
                              {new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </>
                          ) : (
                            <span className="capitalize text-muted-foreground/70">{task.priority}</span>
                          )}
                        </div>
                        <div className="flex -space-x-1.5">
                          {(task.assigneeUserIds || []).slice(0, 3).map((assigneeId: string) => {
                            const member = workspaceMembers.find((m: any) => m.userId === assigneeId);
                            const isYou = assigneeId === currentUser?.id;
                            const name = isYou ? 'You' : member?.displayName || '?';
                            return (
                              <Avatar key={assigneeId} className="h-6 w-6 border-2 border-card">
                                <AvatarImage src={member?.avatarUrl || undefined} />
                                <AvatarFallback className="text-[9px] font-semibold bg-muted">
                                  {name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            );
                          })}
                          {(task.assigneeUserIds || []).length > 3 && (
                            <div className="h-6 w-6 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[9px] text-muted-foreground font-medium">
                              +{(task.assigneeUserIds || []).length - 3}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {!readOnly && (
                <button
                  type="button"
                  onClick={() => onAddTask?.(col.id)}
                  className="w-full flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-card hover:text-foreground hover:shadow-sm border border-transparent hover:border-border/60 transition-all"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add task
                </button>
              )}

              {columnTasks.length === 0 && (
                <div className="flex items-center justify-center h-24 text-xs text-muted-foreground/60 pointer-events-none">
                  Drop tasks here
                </div>
              )}
            </div>
          </div>
        );
      })}

      {canManageStatuses && (
        <button
          type="button"
          onClick={onAddStatus}
          className="w-[220px] min-w-[220px] shrink-0 snap-start rounded-xl border-2 border-dashed border-border/70 bg-muted/10 hover:bg-muted/30 hover:border-primary/40 transition-all flex flex-col items-center justify-center gap-2 min-h-[200px] text-muted-foreground hover:text-foreground"
        >
          <div className="h-10 w-10 rounded-full bg-card border shadow-sm flex items-center justify-center">
            <Plus className="h-5 w-5" />
          </div>
          <span className="text-sm font-semibold">Add status</span>
          <span className="text-[11px] text-muted-foreground px-4 text-center">
            Create a custom column for your workflow
          </span>
        </button>
      )}
    </div>
  );
}

/** @deprecated kept for any leftover imports */
export function resolvePipelineName(pipelines: Pipeline[], statusId: string) {
  return getPipelineInfo(pipelines, statusId).name;
}
