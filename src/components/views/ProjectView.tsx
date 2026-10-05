"use client";

import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutList,
  Kanban,
  Plus,
  Calendar as CalendarIcon,
  Tag as TagIcon,
  Loader2,
  Users,
  Settings,
  Columns3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TaskList } from '../tasks/TaskList';
import { KanbanBoard } from '../tasks/KanbanBoard';
import { ManageStatusesDialog } from '../tasks/ManageStatusesDialog';
import { TaskDetailPanel } from '../tasks/TaskDetailPanel';
import { EditProjectModal } from '../projects/EditProjectModal';
import { DeleteProjectButton } from '../projects/DeleteProjectButton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Status, Priority, Pipeline } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  getOpenStatusId,
  getProjectPipelines,
  getPipelineInfo,
} from '@/lib/pipelines';

export function ProjectView({ store }: { store: any }) {
  const { toast } = useToast();
  type ProjectViewMode = 'list' | 'board' | 'calendar';
  const [view, setView] = useState<ProjectViewMode>(store.preferredProjectView || 'list');
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [isStatusesOpen, setIsStatusesOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(new Date());

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskStatus, setNewTaskStatus] = useState<Status>('todo');
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>('medium');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
  const [newTaskTags, setNewTaskTags] = useState('');

  const activeProject = store.activeProject;
  const selectedTaskId = store.selectedTaskId as string | null;
  const pipelines = useMemo(() => getProjectPipelines(activeProject), [activeProject]);

  const changeView = (next: ProjectViewMode) => {
    setView(next);
    store.setProjectViewPreference?.(next);
  };

  useEffect(() => {
    if (store.preferredProjectView) setView(store.preferredProjectView);
  }, [store.preferredProjectView]);

  useEffect(() => {
    if (!pipelines.some((p) => p.id === newTaskStatus)) {
      setNewTaskStatus(getOpenStatusId(pipelines));
    }
  }, [pipelines, newTaskStatus]);

  const filteredTasks = useMemo(() => {
    const q = (store.globalSearchQuery || '').trim().toLowerCase();
    return (store.projectTasks || []).filter((t: any) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      const assignees: string[] = t.assigneeUserIds || [];
      if (assigneeFilter === 'me' && !assignees.includes(store.currentUser?.id)) return false;
      if (assigneeFilter === 'unassigned' && assignees.length > 0) return false;
      if (
        assigneeFilter !== 'all' &&
        assigneeFilter !== 'me' &&
        assigneeFilter !== 'unassigned' &&
        !assignees.includes(assigneeFilter)
      ) {
        return false;
      }
      if (!q) return true;
      const title = (t.title || '').toLowerCase();
      const tags = (t.tags || []).map((x: string) => x.toLowerCase());
      return title.includes(q) || tags.some((tag: string) => tag.includes(q));
    });
  }, [
    store.projectTasks,
    store.globalSearchQuery,
    store.currentUser?.id,
    statusFilter,
    priorityFilter,
    assigneeFilter,
  ]);

  const dayTasks = useMemo(() => {
    if (!selectedDay) return [];
    const key = selectedDay.toISOString().slice(0, 10);
    return filteredTasks.filter((t: any) => t.dueDate && t.dueDate.slice(0, 10) === key);
  }, [filteredTasks, selectedDay]);

  const dueDates = useMemo(() => {
    return filteredTasks
      .filter((t: any) => t.dueDate)
      .map((t: any) => new Date(t.dueDate as string));
  }, [filteredTasks]);

  const eligibleAssignees = useMemo(() => {
    if (!activeProject) return [];
    const allowed = new Set<string>(activeProject.allowedUserIds || []);
    return (store.workspaceMembers || []).filter((m: any) => {
      const isWorkspaceAdmin = m.role === 'owner' || m.role === 'lead';
      return isWorkspaceAdmin || allowed.has(m.userId);
    });
  }, [store.workspaceMembers, activeProject]);

  useEffect(() => {
    if (isCreateTaskOpen && store.currentUser) {
      setNewTaskAssignees([store.currentUser.id]);
    }
  }, [isCreateTaskOpen, store.currentUser]);

  const handleCreateTask = async () => {
    if (newTaskTitle && activeProject) {
      const tagsArray = newTaskTags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag !== '');

      try {
        await store.createTask(activeProject.workspaceId, activeProject.id, {
          title: newTaskTitle,
          description: newTaskDesc,
          status: newTaskStatus,
          priority: newTaskPriority,
          dueDate: newTaskDueDate ? new Date(newTaskDueDate).toISOString() : null,
          assigneeUserIds: newTaskAssignees.length > 0 ? newTaskAssignees : [store.currentUser?.id],
          tags: tagsArray,
        });
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Could not create task',
          description: error?.message || 'Please try again.',
        });
        return;
      }

      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskStatus(getOpenStatusId(pipelines));
      setNewTaskPriority('medium');
      setNewTaskDueDate('');
      setNewTaskAssignees([store.currentUser?.id || '']);
      setNewTaskTags('');
      setIsCreateTaskOpen(false);
    }
  };

  const handleToggleMember = (userId: string) => {
    if (!activeProject) return;
    const member = store.workspaceMembers?.find((m: any) => m.userId === userId);
    const isSystemAdmin = member?.role === 'owner' || member?.role === 'lead';
    const isProjectAdmin = Boolean(
      activeProject.createdByUserId && userId === activeProject.createdByUserId
    );
    if (isSystemAdmin || isProjectAdmin) return;
    const current: string[] = activeProject.allowedUserIds || [];
    const next = current.includes(userId)
      ? current.filter((id: string) => id !== userId)
      : [...current, userId];
    store.updateProjectMembers(activeProject.id, next);
  };

  const handleSavePipelines = async (next: Pipeline[]) => {
    if (!activeProject) return;
    const removedIds = pipelines.filter((p) => !next.some((n) => n.id === p.id)).map((p) => p.id);
    const fallback = getOpenStatusId(next);

    await store.updateProjectPipelines(activeProject.id, next);

    // Reassign tasks that used a removed status
    if (removedIds.length > 0) {
      const affected = (store.projectTasks || []).filter((t: any) => removedIds.includes(t.status));
      for (const t of affected) {
        store.updateTask(t.id, { status: fallback });
      }
    }

    toast({ title: 'Statuses updated' });
  };

  if (!activeProject) return null;

  return (
    <div className="flex flex-col h-full gap-5 max-w-[1600px] mx-auto w-full">
      <div className="rounded-2xl border border-border/60 bg-card/80 shadow-sm p-3 md:p-4 space-y-3">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="view-toolbar w-fit">
              <Button
                variant={view === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 gap-2"
                onClick={() => changeView('list')}
              >
                <LayoutList className="h-4 w-4" />
                List
              </Button>
              <Button
                variant={view === 'board' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 gap-2"
                onClick={() => changeView('board')}
              >
                <Kanban className="h-4 w-4" />
                Board
              </Button>
              <Button
                variant={view === 'calendar' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 gap-2"
                onClick={() => changeView('calendar')}
              >
                <CalendarIcon className="h-4 w-4" />
                Calendar
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-[140px] text-xs bg-background">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="h-8 w-[130px] text-xs bg-background">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger className="h-8 w-[140px] text-xs bg-background">
                  <SelectValue placeholder="Assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All assignees</SelectItem>
                  <SelectItem value="me">Assigned to me</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {eligibleAssignees.map((m: any) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {m.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {store.isAdmin && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 h-8"
                  onClick={() => setIsStatusesOpen(true)}
                >
                  <Columns3 className="h-4 w-4" />
                  Statuses
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 h-8"
                  onClick={() => setIsEditProjectOpen(true)}
                >
                  <Settings className="h-4 w-4" />
                  Edit
                </Button>
                <DeleteProjectButton
                  store={store}
                  project={activeProject}
                  variant="outline"
                  size="sm"
                  className="gap-2 h-8 border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                />
                <Dialog open={isMembersOpen} onOpenChange={setIsMembersOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 h-8">
                      <Users className="h-4 w-4" />
                      Team
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                      <DialogTitle>Project access</DialogTitle>
                      <DialogDescription>Choose who can see this project.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2 max-h-[400px] overflow-y-auto">
                      {store.workspaceMembers.map((m: any) => {
                        const isSystemAdmin = m.role === 'owner' || m.role === 'lead';
                        const isProjectAdmin = Boolean(
                          activeProject.createdByUserId && m.userId === activeProject.createdByUserId
                        );
                        const projectAdmin = isSystemAdmin || isProjectAdmin;
                        const hasAccess =
                          projectAdmin || (activeProject.allowedUserIds || []).includes(m.userId);

                        return (
                          <div
                            key={m.userId}
                            className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={m.avatarUrl} />
                                <AvatarFallback>{m.displayName?.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">{m.displayName}</span>
                                <span className="text-[10px] text-muted-foreground uppercase">
                                  {projectAdmin ? 'admin' : 'member'}
                                </span>
                              </div>
                            </div>
                            <Checkbox
                              checked={hasAccess}
                              disabled={projectAdmin}
                              onCheckedChange={() => handleToggleMember(m.userId)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}

            {store.isAdmin && (
              <Dialog open={isCreateTaskOpen} onOpenChange={setIsCreateTaskOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2 h-8 shadow-sm">
                    <Plus className="h-4 w-4" />
                    Add Task
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create task</DialogTitle>
                    <DialogDescription>Add a task to {activeProject.name}.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-5 py-2">
                    <div className="space-y-2">
                      <Label htmlFor="task-title">Title</Label>
                      <Input
                        id="task-title"
                        placeholder="What needs to be done?"
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select
                          value={newTaskStatus}
                          onValueChange={(val: Status) => setNewTaskStatus(val)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {pipelines.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                <span className="flex items-center gap-2">
                                  <span
                                    className="h-2 w-2 rounded-full"
                                    style={{ backgroundColor: p.color }}
                                  />
                                  {p.name}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Priority</Label>
                        <Select
                          value={newTaskPriority}
                          onValueChange={(val: Priority) => setNewTaskPriority(val)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Due date</Label>
                        <div className="relative">
                          <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="date"
                            className="pl-9"
                            value={newTaskDueDate}
                            onChange={(e) => setNewTaskDueDate(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Assignees</Label>
                        <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
                          {eligibleAssignees.map((m: any) => (
                            <div key={m.userId} className="flex items-center space-x-2">
                              <Checkbox
                                id={`assignee-${m.userId}`}
                                checked={newTaskAssignees.includes(m.userId)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setNewTaskAssignees([...newTaskAssignees, m.userId]);
                                  } else {
                                    setNewTaskAssignees(
                                      newTaskAssignees.filter((id) => id !== m.userId)
                                    );
                                  }
                                }}
                              />
                              <Label
                                htmlFor={`assignee-${m.userId}`}
                                className="flex items-center gap-2 cursor-pointer flex-1"
                              >
                                <Avatar className="h-4 w-4">
                                  <AvatarImage src={m.avatarUrl} />
                                  <AvatarFallback>
                                    {(m.displayName || '?').charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="truncate text-sm">{m.displayName || 'Unnamed'}</span>
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="task-desc">Description</Label>
                      <Textarea
                        id="task-desc"
                        placeholder="Details, links, acceptance criteria…"
                        value={newTaskDesc}
                        onChange={(e) => setNewTaskDesc(e.target.value)}
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="task-tags" className="flex items-center gap-1.5">
                        <TagIcon className="h-3 w-3" /> Tags
                      </Label>
                      <Input
                        id="task-tags"
                        placeholder="Design, Frontend (comma separated)"
                        value={newTaskTags}
                        onChange={(e) => setNewTaskTags(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateTaskOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateTask}>Create task</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground px-0.5">
          <span className="font-medium text-foreground">{filteredTasks.length}</span> tasks
          <span className="text-border">·</span>
          <span>{pipelines.length} statuses</span>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {store.isTasksLoading ? (
          <div className="h-full flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading tasks...</p>
          </div>
        ) : view === 'list' ? (
          <TaskList
            tasks={filteredTasks}
            onTaskClick={(id) => store.openTask?.(id)}
            updateTask={store.updateTask}
            readOnly={false}
            subtasks={store.allWorkspaceSubtasks}
            workspaceMembers={store.workspaceMembers}
            currentUser={store.currentUser}
            pipelines={pipelines}
          />
        ) : view === 'board' ? (
          <KanbanBoard
            tasks={filteredTasks}
            pipelines={pipelines}
            onTaskClick={(id) => store.openTask?.(id)}
            updateTask={store.updateTask}
            onAddTask={(status) => {
              if (store.isAdmin) {
                setNewTaskStatus(status);
                setIsCreateTaskOpen(true);
              }
            }}
            onAddStatus={() => setIsStatusesOpen(true)}
            canManageStatuses={store.isAdmin}
            readOnly={false}
            subtasks={store.allWorkspaceSubtasks}
            workspaceMembers={store.workspaceMembers}
            currentUser={store.currentUser}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 h-full">
            <Calendar
              mode="single"
              selected={selectedDay}
              onSelect={setSelectedDay}
              modifiers={{ due: dueDates }}
              modifiersClassNames={{ due: 'bg-primary/15 font-semibold' }}
              className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm"
            />
            <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold">
                Due{' '}
                {selectedDay?.toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
              </h3>
              {dayTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-10 text-center">
                  No tasks due on this day.
                </p>
              ) : (
                dayTasks.map((task: any) => {
                  const pipeline = getPipelineInfo(pipelines, task.status);
                  return (
                    <button
                      key={task.id}
                      type="button"
                      className="w-full text-left p-3.5 rounded-xl border bg-background hover:bg-muted/40 transition-colors"
                      onClick={() => store.openTask?.(task.id)}
                    >
                      <div className="font-medium text-sm">{task.title}</div>
                      <div className="flex gap-2 mt-2">
                        <Badge
                          variant="secondary"
                          className="text-[10px] gap-1.5"
                          style={{ borderColor: pipeline.color }}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: pipeline.color }}
                          />
                          {pipeline.name}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {task.priority}
                        </Badge>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          isOpen={!!selectedTaskId}
          onClose={() => store.closeTask?.()}
          store={store}
        />
      )}

      <EditProjectModal
        isOpen={isEditProjectOpen}
        onOpenChange={setIsEditProjectOpen}
        store={store}
        project={activeProject}
      />

      <ManageStatusesDialog
        open={isStatusesOpen}
        onOpenChange={setIsStatusesOpen}
        pipelines={pipelines}
        onSave={handleSavePipelines}
      />
    </div>
  );
}
