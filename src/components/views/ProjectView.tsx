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
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TaskList } from '../tasks/TaskList';
import { KanbanBoard } from '../tasks/KanbanBoard';
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
  DialogDescription
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Status, Priority } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function ProjectView({ store }: { store: any }) {
  const { toast } = useToast();
  type ProjectViewMode = 'list' | 'board' | 'calendar';
  const [view, setView] = useState<ProjectViewMode>(store.preferredProjectView || 'list');
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(new Date());

  // Form State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskStatus, setNewTaskStatus] = useState<Status>('todo');
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>('medium');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
  const [newTaskTags, setNewTaskTags] = useState('');

  const activeProject = store.activeProject;
  const selectedTaskId = store.selectedTaskId as string | null;

  const changeView = (next: ProjectViewMode) => {
    setView(next);
    store.setProjectViewPreference?.(next);
  };

  useEffect(() => {
    if (store.preferredProjectView) setView(store.preferredProjectView);
  }, [store.preferredProjectView]);

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
      const canSeeProject = isWorkspaceAdmin || allowed.has(m.userId);
      return canSeeProject;
    });
  }, [store.workspaceMembers, activeProject]);

  useEffect(() => {
    if (isCreateTaskOpen && store.currentUser) {
      setNewTaskAssignees([store.currentUser.id]);
    }
  }, [isCreateTaskOpen, store.currentUser]);

  const handleCreateTask = async () => {
    if (newTaskTitle && activeProject) {
      const tagsArray = newTaskTags.split(',').map(tag => tag.trim()).filter(tag => tag !== '');
      
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
      setNewTaskStatus('todo');
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
    const updated = current.includes(userId)
      ? current.filter((id: string) => id !== userId)
      : [...current, userId];
    store.updateProjectMembers(activeProject.id, updated);
  };

  if (!activeProject) return null;

  return (
    <div className="flex flex-col h-full space-y-6 max-w-[1400px] mx-auto w-full">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
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
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
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
              <SelectTrigger className="h-8 w-[140px] text-xs">
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

        <div className="flex items-center gap-2">
          {store.isAdmin && (
            <>
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
                className="gap-2 h-8 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
              />
              <Dialog open={isMembersOpen} onOpenChange={setIsMembersOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 h-8">
                    <Users className="h-4 w-4" />
                    Project Team
                  </Button>
                </DialogTrigger>
              <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                  <DialogTitle>Project Access</DialogTitle>
                  <DialogDescription>Assign members who can see this project.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 max-h-[400px] overflow-y-auto">
                  {store.workspaceMembers.map((m: any) => {
                    // "Admin" in the Project Team UI:
                    // - Workspace owners/leads are always project admins
                    // - The user who created the project is also treated as an admin for that project
                    const isSystemAdmin = m.role === 'owner' || m.role === 'lead';
                    const isProjectAdmin = Boolean(
                      activeProject.createdByUserId && m.userId === activeProject.createdByUserId
                    );
                    const projectAdmin = isSystemAdmin || isProjectAdmin;
                    const hasAccess = projectAdmin || (activeProject.allowedUserIds || []).includes(m.userId);
                    
                    return (
                      <div key={m.userId} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
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
                <Button size="sm" className="gap-2 h-8">
                  <Plus className="h-4 w-4" />
                  Add Task
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Task</DialogTitle>
                  <DialogDescription>Add a new task to {activeProject.name}.</DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="task-title">Task Title</Label>
                    <Input 
                      id="task-title"
                      placeholder="E.g. Design homepage hero" 
                      value={newTaskTitle} 
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={newTaskStatus} onValueChange={(val: Status) => setNewTaskStatus(val)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todo">To Do</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="on_hold">On Hold</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select value={newTaskPriority} onValueChange={(val: Priority) => setNewTaskPriority(val)}>
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
                      <Label>Due Date</Label>
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
                                  setNewTaskAssignees(newTaskAssignees.filter(id => id !== m.userId));
                                }
                              }}
                            />
                            <Label 
                              htmlFor={`assignee-${m.userId}`}
                              className="flex items-center gap-2 cursor-pointer flex-1"
                            >
                              <Avatar className="h-4 w-4">
                                <AvatarImage src={m.avatarUrl} />
                                <AvatarFallback>{(m.displayName || '?').charAt(0)}</AvatarFallback>
                              </Avatar>
                              <span className="truncate text-sm">{m.displayName || 'Unnamed'}</span>
                            </Label>
                          </div>
                        ))}
                      </div>
                      {newTaskAssignees.length === 0 && (
                        <p className="text-xs text-muted-foreground">No assignees selected</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="task-desc">Description</Label>
                    <Textarea 
                      id="task-desc"
                      placeholder="What needs to be done?" 
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
                      placeholder="E.g. Design, Frontend (comma separated)" 
                      value={newTaskTags}
                      onChange={(e) => setNewTaskTags(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateTaskOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreateTask}>Create Task</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
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
          />
        ) : view === 'board' ? (
          <KanbanBoard 
            tasks={filteredTasks} 
            onTaskClick={(id) => store.openTask?.(id)} 
            updateTask={store.updateTask}
            onAddTask={(status) => {
              if (store.isAdmin) {
                setNewTaskStatus(status);
                setIsCreateTaskOpen(true);
              }
            }}
            readOnly={false}
            subtasks={store.allWorkspaceSubtasks}
            workspaceMembers={store.workspaceMembers}
            currentUser={store.currentUser}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 h-full">
            <Calendar
              mode="single"
              selected={selectedDay}
              onSelect={setSelectedDay}
              modifiers={{ due: dueDates }}
              modifiersClassNames={{ due: 'bg-primary/15 font-semibold' }}
              className="rounded-lg border bg-card p-3"
            />
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Due {selectedDay?.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
              </h3>
              {dayTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks due on this day.</p>
              ) : (
                dayTasks.map((task: any) => (
                  <button
                    key={task.id}
                    type="button"
                    className="w-full text-left p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors"
                    onClick={() => store.openTask?.(task.id)}
                  >
                    <div className="font-medium text-sm">{task.title}</div>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {task.status.replace('_', ' ')}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {task.priority}
                      </Badge>
                    </div>
                  </button>
                ))
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
    </div>
  );
}
