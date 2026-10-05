"use client";

import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Task, Priority, Pipeline } from '@/lib/types';
import { CheckCircle2, CalendarDays } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  DEFAULT_PIPELINES,
  getClosedStatusId,
  getOpenStatusId,
  getPipelineInfo,
  isClosedStatus,
} from '@/lib/pipelines';

const priorityColors: Record<Priority, string> = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

export function TaskList({
  tasks,
  onTaskClick,
  updateTask,
  readOnly = false,
  subtasks = [],
  workspaceMembers = [],
  currentUser = null,
  pipelines = DEFAULT_PIPELINES,
}: {
  tasks: Task[];
  onTaskClick: (id: string) => void;
  updateTask: any;
  readOnly?: boolean;
  subtasks?: any[];
  workspaceMembers?: any[];
  currentUser?: any;
  pipelines?: Pipeline[];
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const closedId = getClosedStatusId(pipelines);
  const openId = getOpenStatusId(pipelines);

  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card shadow-sm py-16 text-center text-sm text-muted-foreground">
        No tasks match your filters.
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border/60 overflow-hidden shadow-sm">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[44px]" />
            <TableHead className="min-w-[280px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Task
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Status
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Priority
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Assignees
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Due
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const done = isClosedStatus(pipelines, task.status);
            const pipeline = getPipelineInfo(pipelines, task.status);
            const st = (subtasks || []).filter((s) => s.taskId === task.id);
            const subDone = st.filter((s) => s.status === closedId).length;

            return (
              <TableRow
                key={task.id}
                className="cursor-pointer group hover:bg-muted/40 border-border/50"
                onClick={() => onTaskClick(task.id)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={done}
                    disabled={readOnly}
                    onCheckedChange={(checked) => {
                      updateTask(task.id, { status: checked ? closedId : openId });
                    }}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className={cn('font-medium text-sm', done && 'line-through text-muted-foreground')}>
                      {task.title}
                    </span>
                    {task.tags && task.tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {task.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] bg-muted px-1.5 py-0.5 rounded-md text-muted-foreground font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {st.length > 0 && (
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>
                          {subDone}/{st.length}
                        </span>
                        <Progress value={(subDone / st.length) * 100} className="h-1 w-12" />
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-2.5 py-1">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: pipeline.color }}
                    />
                    <span className="text-xs font-medium">{pipeline.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn('capitalize border-none font-medium', priorityColors[task.priority])}
                  >
                    {task.priority}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center -space-x-1.5">
                    {(task.assigneeUserIds || []).slice(0, 3).map((assigneeId: string) => {
                      const member = workspaceMembers.find((m: any) => m.userId === assigneeId);
                      const isYou = assigneeId === currentUser?.id;
                      const name = isYou ? 'You' : member?.displayName || '?';
                      return (
                        <Avatar key={assigneeId} className="h-7 w-7 border-2 border-card">
                          <AvatarImage src={member?.avatarUrl || undefined} />
                          <AvatarFallback className="text-[10px] font-semibold bg-muted">
                            {name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      );
                    })}
                    {(task.assigneeUserIds || []).length > 3 && (
                      <div className="h-7 w-7 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[10px] text-muted-foreground">
                        +{(task.assigneeUserIds || []).length - 3}
                      </div>
                    )}
                    {(!task.assigneeUserIds || task.assigneeUserIds.length === 0) && (
                      <span className="text-xs text-muted-foreground">Unassigned</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {mounted && task.dueDate ? (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {new Date(task.dueDate).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  ) : task.dueDate ? (
                    '...'
                  ) : (
                    '—'
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
