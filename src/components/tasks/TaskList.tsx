"use client";

import React, { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
import { Task, Priority, Pipeline, Project } from '@/lib/types';
import { CalendarDays, CheckCircle2, GripVertical } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { ChangeReasonDialog, type PendingMajorChange } from '@/components/tasks/ChangeReasonDialog';
import {
  DEFAULT_PIPELINES,
  getClosedStatusId,
  getOpenStatusId,
  getPipelineInfo,
  getProjectPipelines,
  isClosedStatus,
  isTaskClosed,
  getTaskPipelineInfo,
} from '@/lib/pipelines';

const priorityColors: Record<Priority, string> = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

function SortableTaskRow({
  task,
  readOnly,
  canReorder,
  onTaskClick,
  setPendingChange,
  subtasks,
  workspaceMembers,
  currentUser,
  pipelines,
  workspaceProjects,
  mounted,
}: {
  task: Task;
  readOnly: boolean;
  canReorder: boolean;
  onTaskClick: (id: string) => void;
  setPendingChange: (v: (PendingMajorChange & { taskId: string }) | null) => void;
  subtasks: any[];
  workspaceMembers: any[];
  currentUser: any;
  pipelines: Pipeline[];
  workspaceProjects: Project[] | null;
  mounted: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: !canReorder });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
    position: 'relative',
    zIndex: isDragging ? 20 : undefined,
  };

  const projectPipelines = workspaceProjects
    ? getProjectPipelines(workspaceProjects.find((p) => p.id === task.projectId))
    : pipelines;
  const done = workspaceProjects
    ? isTaskClosed(task, workspaceProjects)
    : isClosedStatus(pipelines, task.status);
  const pipeline = workspaceProjects
    ? getTaskPipelineInfo(task, workspaceProjects)
    : getPipelineInfo(pipelines, task.status);
  const taskClosedId = getClosedStatusId(projectPipelines);
  const taskOpenId = getOpenStatusId(projectPipelines);
  const st = (subtasks || []).filter((s) => s.taskId === task.id);
  const subDone = st.filter((s) => s.status === taskClosedId).length;

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(
        'cursor-pointer group hover:bg-muted/40 border-border/50',
        isDragging && 'bg-muted/60 shadow-md'
      )}
      onClick={() => onTaskClick(task.id)}
      {...attributes}
    >
      <TableCell className="w-8 px-1" onClick={(e) => e.stopPropagation()}>
        {canReorder ? (
          <button
            type="button"
            ref={setActivatorNodeRef}
            className="inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
            title="Drag to reorder"
            aria-label="Drag to reorder"
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        ) : (
          <span className="inline-flex h-8 w-8" />
        )}
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={done}
          disabled={readOnly}
          onCheckedChange={(checked) => {
            const nextStatus = checked ? taskClosedId : taskOpenId;
            if (nextStatus === task.status) return;
            setPendingChange({
              taskId: task.id,
              title: checked ? 'Mark complete' : 'Reopen task',
              description:
                'A reason is required for this status change and will appear in the audit trail.',
              payload: { status: nextStatus },
            });
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
}

export function TaskList({
  tasks,
  onTaskClick,
  updateTask,
  reorderTasks,
  canReorder = false,
  readOnly = false,
  subtasks = [],
  workspaceMembers = [],
  currentUser = null,
  pipelines = DEFAULT_PIPELINES,
  workspaceProjects = null,
}: {
  tasks: Task[];
  onTaskClick: (id: string) => void;
  updateTask: any;
  reorderTasks?: (orderedTaskIds: string[]) => void | Promise<void>;
  canReorder?: boolean;
  readOnly?: boolean;
  subtasks?: any[];
  workspaceMembers?: any[];
  currentUser?: any;
  pipelines?: Pipeline[];
  workspaceProjects?: Project[] | null;
}) {
  const [mounted, setMounted] = useState(false);
  const [pendingChange, setPendingChange] = useState<(PendingMajorChange & { taskId: string }) | null>(
    null
  );
  const [orderedTasks, setOrderedTasks] = useState<Task[]>(tasks);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setOrderedTasks(tasks);
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const ids = useMemo(() => orderedTasks.map((t) => t.id), [orderedTasks]);
  const allowDrag = Boolean(canReorder && reorderTasks && !readOnly);

  const handleDragEnd = (event: DragEndEvent) => {
    if (!allowDrag || !reorderTasks) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedTasks.findIndex((t) => t.id === active.id);
    const newIndex = orderedTasks.findIndex((t) => t.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(orderedTasks, oldIndex, newIndex);
    setOrderedTasks(next);
    void reorderTasks(next.map((t) => t.id));
  };

  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card shadow-sm py-16 text-center text-sm text-muted-foreground">
        No tasks match your filters.
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border/60 overflow-hidden shadow-sm">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8 px-1" />
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
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              {orderedTasks.map((task) => (
                <SortableTaskRow
                  key={task.id}
                  task={task}
                  readOnly={readOnly}
                  canReorder={allowDrag}
                  onTaskClick={onTaskClick}
                  setPendingChange={setPendingChange}
                  subtasks={subtasks}
                  workspaceMembers={workspaceMembers}
                  currentUser={currentUser}
                  pipelines={pipelines}
                  workspaceProjects={workspaceProjects}
                  mounted={mounted}
                />
              ))}
            </SortableContext>
          </TableBody>
        </Table>
      </DndContext>

      <ChangeReasonDialog
        open={!!pendingChange}
        pending={pendingChange}
        onOpenChange={(open) => {
          if (!open) setPendingChange(null);
        }}
        onConfirm={(reason) => {
          if (!pendingChange) return;
          updateTask(pendingChange.taskId, pendingChange.payload, { reason });
          setPendingChange(null);
        }}
      />
    </div>
  );
}
