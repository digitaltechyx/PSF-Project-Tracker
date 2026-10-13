"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Sparkles,
  Calendar,
  Trash2,
  X,
  Loader2,
  Plus,
  MessageSquare,
  Send,
  Edit2,
  List,
  History,
  Clock3,
  Check,
  UserPlus,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChangeReasonDialog, type PendingMajorChange } from '@/components/tasks/ChangeReasonDialog';
import { generateTaskDescription } from '@/ai/flows/ai-task-description-generation';
import { suggestTaskAttributes } from '@/ai/flows/ai-task-attribute-suggestion';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import {
  getClosedStatusId,
  getOpenStatusId,
  getPipelineInfo,
  getProjectPipelines,
  isClosedStatus,
} from '@/lib/pipelines';
import { Pipeline, TaskAudit, TaskTimeLog } from '@/lib/types';
import {
  formatAuditDisplayValue,
  formatAuditFieldLabel,
  formatDurationMinutes,
  groupTimeLogsByDate,
  isMajorChangeField,
} from '@/lib/task-audit';

const renderCommentBody = (text: string) => {
  if (!text) return null;
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const bulletMatch = line.match(/^(\s*)([-*•])\s+(.*)/);
    
    if (bulletMatch) {
      currentList.push(<li key={i} className="ml-4 list-disc">{bulletMatch[3]}</li>);
    } else {
      if (currentList.length > 0) {
        result.push(<ul key={`ul-${i}`} className="my-1 space-y-1">{currentList}</ul>);
        currentList = [];
      }
      result.push(<div key={`p-${i}`} className={line.trim() === '' ? 'h-4' : 'min-h-[1.25rem]'}>{line}</div>);
    }
  }
  
  if (currentList.length > 0) {
    result.push(<ul key={`ul-end`} className="my-1 space-y-1">{currentList}</ul>);
  }
  
  return <div className="text-sm">{result}</div>;
};

const handleKeyDownBullets = (e: React.KeyboardEvent<HTMLTextAreaElement>, value: string, setValue: (v: string) => void) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    const target = e.target as HTMLTextAreaElement;
    const start = target.selectionStart;
    const textBeforeCursor = value.substring(0, start);
    const lines = textBeforeCursor.split('\n');
    const currentLine = lines[lines.length - 1];
    const bulletMatch = currentLine.match(/^(\s*)([-*•])\s+(.*)/);
    
    if (bulletMatch) {
      e.preventDefault();
      if (!bulletMatch[3].trim()) {
        const newValue = value.substring(0, start - currentLine.length) + '\n' + value.substring(start);
        setValue(newValue);
        setTimeout(() => { target.selectionStart = target.selectionEnd = start - currentLine.length + 1; }, 0);
      } else {
        const prefix = bulletMatch[1] + (bulletMatch[2] === '•' ? '•' : '-') + ' ';
        const newValue = value.substring(0, start) + '\n' + prefix + value.substring(start);
        setValue(newValue);
        setTimeout(() => { target.selectionStart = target.selectionEnd = start + prefix.length + 1; }, 0);
      }
    }
  }
};

function SubtaskAssigneePicker({
  subtask,
  projectMembers,
  disabled,
  onChange,
}: {
  subtask: any;
  projectMembers: any[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
}) {
  const ids: string[] = subtask.assigneeUserIds || [];
  const selected = projectMembers.filter((m) => ids.includes(m.userId));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-transparent px-1 text-muted-foreground transition-colors hover:border-border hover:bg-muted/60 disabled:opacity-50',
            selected.length > 0 && 'px-1.5'
          )}
          title={selected.length ? selected.map((m) => m.displayName).join(', ') : 'Assign'}
        >
          {selected.length > 0 ? (
            <span className="flex -space-x-1.5">
              {selected.slice(0, 2).map((m) => (
                <Avatar key={m.userId} className="h-5 w-5 border border-background">
                  <AvatarImage src={m.avatarUrl} />
                  <AvatarFallback className="text-[8px]">{m.displayName?.charAt(0)}</AvatarFallback>
                </Avatar>
              ))}
              {selected.length > 2 && (
                <span className="grid h-5 w-5 place-items-center rounded-full bg-muted text-[9px] font-medium">
                  +{selected.length - 2}
                </span>
              )}
            </span>
          ) : (
            <UserPlus className="h-3.5 w-3.5" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2">
        <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Assignees
        </p>
        <div className="max-h-48 space-y-0.5 overflow-y-auto">
          {projectMembers.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">No members</p>
          ) : (
            projectMembers.map((m) => {
              const checked = ids.includes(m.userId);
              return (
                <button
                  key={m.userId}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted/70',
                    checked && 'bg-primary/5'
                  )}
                  onClick={() => {
                    onChange(
                      checked ? ids.filter((id) => id !== m.userId) : [...ids, m.userId]
                    );
                  }}
                >
                  <span
                    className={cn(
                      'grid h-4 w-4 place-items-center rounded-sm border border-primary',
                      checked && 'bg-primary text-primary-foreground'
                    )}
                  >
                    {checked ? <Check className="h-3 w-3" /> : null}
                  </span>
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={m.avatarUrl} />
                    <AvatarFallback className="text-[9px]">{m.displayName?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{m.displayName}</span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SubtaskRow({ subtask, store, projectMembers, pipelines }: any) {
  const isAdmin = store.isAdmin;
  const [title, setTitle] = useState(subtask.title || '');
  const closedId = getClosedStatusId(pipelines || []);
  const openId = getOpenStatusId(pipelines || []);
  const done = isClosedStatus(pipelines || [], subtask.status);
  const statusInfo = getPipelineInfo(pipelines || [], subtask.status);

  useEffect(() => {
    setTitle(subtask.title || '');
  }, [subtask.id, subtask.title]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (title.trim() && title !== subtask.title) {
        store.updateSubtask(subtask.taskId, subtask.id, { title: title.trim() });
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [title, subtask.title, subtask.id, subtask.taskId, store]);

  return (
    <div
      className={cn(
        'group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 transition-colors hover:border-border/50 hover:bg-muted/30',
        done && 'opacity-70'
      )}
    >
      <Checkbox
        checked={done}
        onCheckedChange={(c) =>
          store.updateSubtask(subtask.taskId, subtask.id, { status: c ? closedId : openId })
        }
        disabled={!isAdmin}
        className="rounded-full"
      />

      <input
        className={cn(
          'min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60',
          done && 'text-muted-foreground line-through'
        )}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Subtask name"
        disabled={!isAdmin}
      />

      <div className="flex items-center gap-0.5 sm:gap-1">
        <Select
          value={subtask.status}
          onValueChange={(val) => store.updateSubtask(subtask.taskId, subtask.id, { status: val })}
          disabled={!isAdmin}
        >
          <SelectTrigger className="h-7 w-auto max-w-[7.5rem] gap-1.5 border-none bg-transparent px-1.5 text-[11px] shadow-none hover:bg-muted/60">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: statusInfo.color }} />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(pipelines || []).map((p: Pipeline) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={subtask.priority || 'medium'}
          onValueChange={(val) => store.updateSubtask(subtask.taskId, subtask.id, { priority: val })}
          disabled={!isAdmin}
        >
          <SelectTrigger
            className={cn(
              'h-7 w-auto border-none bg-transparent px-1.5 text-[11px] capitalize shadow-none hover:bg-muted/60',
              subtask.priority === 'urgent' && 'text-red-600',
              subtask.priority === 'high' && 'text-orange-600',
              subtask.priority === 'medium' && 'text-blue-600'
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative hidden sm:block">
          <Calendar className="pointer-events-none absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="date"
            className="h-7 w-[8.25rem] border-none bg-transparent pl-6 text-[11px] shadow-none hover:bg-muted/60"
            value={subtask.dueDate ? subtask.dueDate.split('T')[0] : ''}
            onChange={(e) =>
              store.updateSubtask(subtask.taskId, subtask.id, {
                dueDate: e.target.value ? new Date(e.target.value).toISOString() : null,
              })
            }
            disabled={!isAdmin}
          />
        </div>

        <SubtaskAssigneePicker
          subtask={subtask}
          projectMembers={projectMembers || []}
          disabled={!isAdmin}
          onChange={(assigneeUserIds) =>
            store.updateSubtask(subtask.taskId, subtask.id, { assigneeUserIds })
          }
        />

        {isAdmin && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
            onClick={() => {
              if (confirm('Delete this subtask?')) {
                store.deleteSubtask(subtask.taskId, subtask.id);
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function SubtasksTabContent({ task, store, projectMembers, pipelines }: any) {
  const { toast } = useToast();
  const [draft, setDraft] = useState('');
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const openId = getOpenStatusId(pipelines || []);

  const subtasks = useMemo(() => {
    const list = (store.allWorkspaceSubtasks || []).filter((s: any) => s.taskId === task.id);
    return [...list].sort((a: any, b: any) => {
      const aDone = isClosedStatus(pipelines || [], a.status) ? 1 : 0;
      const bDone = isClosedStatus(pipelines || [], b.status) ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    });
  }, [store.allWorkspaceSubtasks, task.id, pipelines]);

  const completedCount = subtasks.filter((s: any) => isClosedStatus(pipelines || [], s.status)).length;
  const totalCount = subtasks.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const createFromDraft = async () => {
    const title = draft.trim();
    if (!title || creating) return;
    if (!store.isAdmin) {
      toast({ title: 'Only workspace admins can add subtasks', variant: 'destructive' });
      return;
    }
    if (!task?.id || !task?.projectId) {
      toast({ title: 'Could not create subtask', description: 'Missing task project.', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      const id = await store.createSubtask(task.id, task.projectId, {
        title,
        status: openId,
        priority: 'medium',
        assigneeUserIds: [],
        dueDate: null,
      });
      if (!id) {
        toast({
          title: 'Subtask not created',
          description: 'Check your permissions and try again.',
          variant: 'destructive',
        });
        return;
      }
      setDraft('');
      requestAnimationFrame(() => inputRef.current?.focus());
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4 py-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">
            {totalCount > 0 ? (
              <>
                <span className="font-semibold text-foreground">{completedCount}</span>
                <span className="text-muted-foreground">/{totalCount} completed</span>
              </>
            ) : (
              'No subtasks yet'
            )}
          </span>
          {totalCount > 0 && (
            <span className="text-xs tabular-nums text-muted-foreground">{Math.round(progressPercent)}%</span>
          )}
        </div>
        <Progress value={progressPercent} className="h-1" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40">
        {totalCount === 0 && (
          <div className="border-b border-dashed border-border/50 px-3 py-6 text-center text-sm text-muted-foreground">
            Break this task into smaller steps. Press Enter to add.
          </div>
        )}

        <div className="divide-y divide-border/40">
          {subtasks.map((st: any) => (
            <SubtaskRow
              key={st.id}
              subtask={st}
              store={store}
              projectMembers={projectMembers}
              pipelines={pipelines}
            />
          ))}
        </div>

        {store.isAdmin && (
          <div className="flex items-center gap-2 border-t border-border/50 bg-muted/15 px-2 py-1.5">
            <Plus className="ml-1 h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
              placeholder="Add a subtask…"
              value={draft}
              disabled={creating}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void createFromDraft();
                }
                if (e.key === 'Escape') {
                  setDraft('');
                  e.currentTarget.blur();
                }
              }}
            />
            {draft.trim() && (
              <Button
                size="sm"
                className="h-7 shrink-0 px-3 text-xs"
                disabled={creating}
                onClick={() => void createFromDraft()}
              >
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add'}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function TaskDetailPanel({
  taskId,
  isOpen,
  onClose,
  store
}: {
  taskId: string,
  isOpen: boolean,
  onClose: () => void,
  store: any
}) {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [isSuggestingAttrs, setIsSuggestingAttrs] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState('');
  const [mounted, setMounted] = useState(false);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagValue, setNewTagValue] = useState('');

  const [localTitle, setLocalTitle] = useState('');
  const [localDesc, setLocalDesc] = useState('');
  const [pendingChange, setPendingChange] = useState<PendingMajorChange | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const task = useMemo(() => {
    if (!taskId) return null;
    return store.allWorkspaceTasks?.find((t: any) => t.id === taskId);
  }, [taskId, store.allWorkspaceTasks]);

  useEffect(() => {
    if (task) {
      setLocalTitle(task.title || '');
      setLocalDesc(task.description || '');
    }
  }, [task?.id]); // Only true mount/switch resets the input, letting user edit smoothly

  const taskProject = useMemo(() => {
    if (!task) return null;
    return store.workspaceProjects?.find((p: any) => p.id === task.projectId) || null;
  }, [task, store.workspaceProjects]);

  const pipelines = useMemo(() => getProjectPipelines(taskProject), [taskProject]);

  const eligibleAssignees = useMemo(() => {
    if (!taskProject) return store.workspaceMembers || [];
    const allowed = new Set<string>(taskProject.allowedUserIds || []);
    return (store.workspaceMembers || []).filter((m: any) => {
      const isWorkspaceAdmin = m.role === 'owner' || m.role === 'lead';
      const canSeeProject = isWorkspaceAdmin || allowed.has(m.userId);
      return canSeeProject;
    });
  }, [store.workspaceMembers, taskProject]);

  const commentsQuery = useMemoFirebase(() => {
    if (!db || !task) return null;
    return query(
      collection(db, 'workspaces', task.workspaceId, 'projects', task.projectId, 'tasks', task.id, 'comments'),
      orderBy('createdAt', 'asc')
    );
  }, [db, task]);

  const { data: commentsData } = useCollection(commentsQuery);
  const comments = useMemo(() => commentsData || [], [commentsData]);

  const auditsQuery = useMemoFirebase(() => {
    if (!db || !task) return null;
    return query(
      collection(db, 'workspaces', task.workspaceId, 'projects', task.projectId, 'tasks', task.id, 'audits'),
      orderBy('createdAt', 'desc')
    );
  }, [db, task]);

  const { data: auditsData } = useCollection<TaskAudit>(auditsQuery);
  const audits = useMemo(() => auditsData || [], [auditsData]);

  const timeLogsQuery = useMemoFirebase(() => {
    if (!db || !task) return null;
    return query(
      collection(db, 'workspaces', task.workspaceId, 'projects', task.projectId, 'tasks', task.id, 'timeLogs'),
      orderBy('createdAt', 'desc')
    );
  }, [db, task]);

  const { data: timeLogsData } = useCollection<TaskTimeLog>(timeLogsQuery);
  const timeLogs = useMemo(() => timeLogsData || [], [timeLogsData]);
  const timeLogsByDate = useMemo(() => groupTimeLogsByDate(timeLogs), [timeLogs]);

  const memberNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of store.workspaceMembers || []) {
      if (m.userId) map[m.userId] = m.displayName || m.email || m.userId;
    }
    return map;
  }, [store.workspaceMembers]);

  const assigneeIds = task?.assigneeUserIds || [];

  const selectedAssignees = useMemo(() => {
    if (!assigneeIds.length) return [];
    const byId = new Map<string, any>();
    for (const m of store.workspaceMembers || []) byId.set(m.userId, m);
    for (const m of eligibleAssignees) byId.set(m.userId, m);
    return assigneeIds.map((id: string) => {
      const m = byId.get(id);
      return (
        m || {
          userId: id,
          displayName: 'Unknown member',
          avatarUrl: undefined,
        }
      );
    });
  }, [assigneeIds, eligibleAssignees, store.workspaceMembers]);

  if (!task) return null;

  const totalLoggedMs = task.totalLoggedMs || 0;

  const isAdmin = store.isAdmin;
  const canEditFields = store.canEditTask ? store.canEditTask(taskId) : isAdmin;
  const canManageMeta = isAdmin;

  const handleUpdate = (field: string, value: any, opts?: { reason?: string }) => {
    if (field === 'assigneeUserIds' || field === 'title') {
      if (!canManageMeta) return;
      store.updateTask(taskId, { [field]: value }, opts?.reason ? { reason: opts.reason } : undefined);
      return;
    }
    if (!canEditFields) return;
    store.updateTask(taskId, { [field]: value }, opts?.reason ? { reason: opts.reason } : undefined);
  };

  const requestMajorUpdate = (
    field: string,
    value: any,
    title: string,
    description?: string
  ) => {
    if (isMajorChangeField(field)) {
      if (field === 'assigneeUserIds' || field === 'title') {
        if (!canManageMeta) return;
      } else if (!canEditFields) {
        return;
      }
      setPendingChange({
        title,
        description:
          description ||
          'This change is recorded in the audit trail. Please explain why it is needed.',
        payload: { [field]: value },
      });
      return;
    }
    handleUpdate(field, value);
  };

  const confirmMajorChange = (reason: string) => {
    if (!pendingChange) return;
    store.updateTask(taskId, pendingChange.payload as any, { reason });
    setPendingChange(null);
  };

  const toggleAssignee = (userId: string) => {
    if (!canManageMeta || !userId) return;
    const current = task.assigneeUserIds || [];
    const next = current.includes(userId)
      ? current.filter((id: string) => id !== userId)
      : [...current, userId];
    const adding = !current.includes(userId);
    const member = eligibleAssignees.find((m: any) => m.userId === userId);
    requestMajorUpdate(
      'assigneeUserIds',
      next,
      adding ? 'Assign member' : 'Remove assignee',
      adding
        ? `Assign ${member?.displayName || 'this member'} to the task.`
        : `Remove ${member?.displayName || 'this member'} from the task.`
    );
  };

  const handleAddTag = () => {
    if (newTagValue.trim()) {
      const updatedTags = [...(task.tags || []), newTagValue.trim()];
      handleUpdate('tags', Array.from(new Set(updatedTags)));
    }
    setNewTagValue('');
    setIsAddingTag(false);
  };

  useEffect(() => {
    if (!mounted || !task) return;
    const timer = setTimeout(() => {
      if (localTitle !== task.title) handleUpdate('title', localTitle);
    }, 500);
    return () => clearTimeout(timer);
  }, [localTitle, task?.title]);

  useEffect(() => {
    if (!mounted || !task) return;
    const timer = setTimeout(() => {
      if (localDesc !== (task.description || '')) handleUpdate('description', localDesc);
    }, 500);
    return () => clearTimeout(timer);
  }, [localDesc, task?.description]);

  const handleGenerateDescription = async () => {
    if (!isAdmin) return;
    setIsGeneratingDesc(true);
    try {
      const result = await generateTaskDescription({ taskTitle: localTitle || task.title });
      setLocalDesc(result.taskDescription);
      handleUpdate('description', result.taskDescription);
      toast({ title: 'AI Description Generated' });
    } catch (error) {
      console.error(error);
    } finally {
      setIsGeneratingDesc(false);
    }
  };

  const handleSuggestAttributes = async () => {
    if (!isAdmin) return;
    setIsSuggestingAttrs(true);
    try {
      const result = await suggestTaskAttributes({ title: task.title, description: task.description });
      requestMajorUpdate(
        'priority',
        result.priority,
        'Update priority (AI suggestion)',
        `AI suggested priority “${result.priority}”. Confirm with a reason to apply it.`
      );
      handleUpdate('tags', result.tags);
      toast({ title: 'AI Attributes Suggested' });
    } catch (error) {
      console.error(error);
    } finally {
      setIsSuggestingAttrs(false);
    }
  };

  const handleDelete = () => {
    if (!isAdmin) return;
    store.deleteTask(taskId);
    onClose();
  };

  const handlePostComment = () => {
    if (newComment.trim()) {
      store.addComment(taskId, newComment.trim());
      setNewComment('');
    }
  };

  const currentStatus = pipelines.find((p) => p.id === task.status);
  const fieldControlClass =
    'h-9 border-border/50 bg-background/80 shadow-none hover:bg-background focus:bg-background';

  const priorityTone =
    task.priority === 'urgent'
      ? 'text-red-600'
      : task.priority === 'high'
        ? 'text-orange-600'
        : task.priority === 'medium'
          ? 'text-blue-600'
          : 'text-slate-600';

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <SheetHeader className="space-y-3 border-b border-border/50 bg-gradient-to-b from-muted/40 to-card px-6 pb-5 pt-6 pr-16 text-left">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]">
                Task
              </Badge>
              {taskProject?.name && (
                <span className="truncate text-xs text-muted-foreground">
                  in <span className="font-medium text-foreground/80">{taskProject.name}</span>
                </span>
              )}
            </div>
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <SheetTitle className="sr-only">{localTitle || 'Task detail'}</SheetTitle>
          <Input
            className="h-auto border-none bg-transparent px-0 py-1 text-[1.65rem] font-semibold leading-tight tracking-[-0.03em] shadow-none placeholder:text-muted-foreground/50 focus-visible:ring-0"
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            placeholder="Task title"
            disabled={!canManageMeta}
          />
        </SheetHeader>

        <Tabs defaultValue="details" className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="sticky top-0 z-10 border-b border-border/50 bg-card/95 px-6 py-3 backdrop-blur">
            <TabsList className="grid h-10 w-full grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="subtasks">Subtasks</TabsTrigger>
              <TabsTrigger value="audit">Audit</TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <TabsContent value="details" className="m-0 space-y-6 px-6 py-5 focus-visible:outline-none focus-visible:ring-0">
              <div className="overflow-hidden rounded-2xl border border-border/60 bg-muted/25">
                <div className="grid grid-cols-[7.5rem_1fr] items-center gap-3 border-b border-border/40 px-4 py-3 sm:grid-cols-[8.5rem_1fr]">
                  <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Status
                  </Label>
                  <Select
                    value={task.status}
                    onValueChange={(val) =>
                      requestMajorUpdate('status', val, 'Update status', 'Explain why the status is changing.')
                    }
                    disabled={!canEditFields}
                  >
                    <SelectTrigger className={cn(fieldControlClass, 'w-full max-w-[220px]')}>
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: currentStatus?.color || '#94a3b8' }}
                        />
                        <SelectValue placeholder="Status" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {pipelines.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                            {p.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-[7.5rem_1fr] items-center gap-3 border-b border-border/40 px-4 py-3 sm:grid-cols-[8.5rem_1fr]">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Priority
                    </Label>
                    {canManageMeta && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-primary"
                        onClick={handleSuggestAttributes}
                        disabled={isSuggestingAttrs}
                        title="Suggest with AI"
                      >
                        {isSuggestingAttrs ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      </Button>
                    )}
                  </div>
                  <Select
                    value={task.priority}
                    onValueChange={(val) =>
                      requestMajorUpdate('priority', val, 'Update priority', 'Explain why the priority is changing.')
                    }
                    disabled={!canEditFields}
                  >
                    <SelectTrigger className={cn(fieldControlClass, 'w-full max-w-[220px]', priorityTone)}>
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

                <div className="grid grid-cols-[7.5rem_1fr] items-center gap-3 border-b border-border/40 px-4 py-3 sm:grid-cols-[8.5rem_1fr]">
                  <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Due date
                  </Label>
                  <div className="relative max-w-[220px]">
                    <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="date"
                      className={cn(fieldControlClass, 'pl-9')}
                      value={task.dueDate ? task.dueDate.split('T')[0] : ''}
                      onChange={(e) =>
                        requestMajorUpdate(
                          'dueDate',
                          e.target.value ? new Date(e.target.value).toISOString() : null,
                          'Update due date',
                          'Explain why the due date is changing.'
                        )
                      }
                      disabled={!canEditFields}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-[7.5rem_1fr] items-start gap-3 px-4 py-3 sm:grid-cols-[8.5rem_1fr]">
                  <Label className="pt-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Assignees
                  </Label>
                  <div className="space-y-2.5">
                    {selectedAssignees.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedAssignees.map((m: any) => (
                          <Badge
                            key={m.userId}
                            variant="secondary"
                            className="gap-1.5 rounded-full py-1 pl-1 pr-2 font-medium"
                          >
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={m.avatarUrl} />
                              <AvatarFallback className="text-[9px]">{m.displayName?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            {m.displayName}
                            {canManageMeta && (
                              <button
                                type="button"
                                className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-destructive"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  toggleAssignee(m.userId);
                                }}
                                aria-label={`Remove ${m.displayName}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No one assigned yet</p>
                    )}

                    {canManageMeta ? (
                      <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-xl border border-border/50 bg-background/70 p-1.5">
                        {eligibleAssignees.length === 0 ? (
                          <p className="px-2 py-3 text-center text-xs text-muted-foreground">No project members</p>
                        ) : (
                          eligibleAssignees.map((m: any) => {
                            const checked = assigneeIds.includes(m.userId);
                            return (
                              <button
                                key={m.userId}
                                type="button"
                                onClick={() => toggleAssignee(m.userId)}
                                className={cn(
                                  'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/70',
                                  checked && 'bg-primary/8 ring-1 ring-primary/15'
                                )}
                              >
                                <span
                                  className={cn(
                                    'grid h-4 w-4 shrink-0 place-items-center rounded-sm border border-primary',
                                    checked && 'bg-primary text-primary-foreground'
                                  )}
                                  aria-hidden
                                >
                                  {checked ? <Check className="h-3 w-3" /> : null}
                                </span>
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={m.avatarUrl} />
                                  <AvatarFallback className="text-[10px]">{m.displayName?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <span className="truncate text-sm">{m.displayName}</span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Description
                  </Label>
                  {canManageMeta && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 rounded-full border-border/60 bg-background/80 text-xs shadow-none"
                      onClick={handleGenerateDescription}
                      disabled={isGeneratingDesc}
                    >
                      {isGeneratingDesc ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      AI Generate
                    </Button>
                  )}
                </div>
                <Textarea
                  placeholder="Add details about this task..."
                  className="min-h-[140px] resize-none border-border/50 bg-muted/20 leading-relaxed shadow-none focus-visible:bg-background"
                  value={localDesc}
                  onChange={(e) => setLocalDesc(e.target.value)}
                  disabled={!canEditFields}
                />
              </div>

              <div className="space-y-3">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Tags
                </Label>
                <div className="flex flex-wrap gap-2">
                  {task.tags?.map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="gap-1 rounded-full px-2.5 py-1">
                      {tag}
                      {canEditFields && (
                        <X
                          className="h-3 w-3 cursor-pointer opacity-60 hover:text-destructive hover:opacity-100"
                          onClick={() => handleUpdate('tags', task.tags.filter((t: string) => t !== tag))}
                        />
                      )}
                    </Badge>
                  ))}
                  {canEditFields && !isAddingTag && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 rounded-full border border-dashed border-border/70 px-2.5 text-xs text-muted-foreground"
                      onClick={() => setIsAddingTag(true)}
                    >
                      <Plus className="mr-1 h-3 w-3" /> Add tag
                    </Button>
                  )}
                  {canEditFields && isAddingTag && (
                    <Input
                      autoFocus
                      className="h-7 w-28 rounded-full border-dashed px-3 py-0 text-xs shadow-none"
                      placeholder="New tag..."
                      value={newTagValue}
                      onChange={(e) => setNewTagValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddTag();
                        if (e.key === 'Escape') {
                          setIsAddingTag(false);
                          setNewTagValue('');
                        }
                      }}
                      onBlur={() => {
                        if (newTagValue.trim()) handleAddTag();
                        else setIsAddingTag(false);
                      }}
                    />
                  )}
                </div>
              </div>

              <Separator className="bg-border/60" />

              <div className="space-y-4 pb-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Comments
                  </Label>
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {comments.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {comments.length === 0 && (
                    <p className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
                      No comments yet. Start the conversation below.
                    </p>
                  )}
                  {comments.map((comment: any) => {
                    const author = store.workspaceMembers.find((m: any) => m.userId === comment.authorUserId);
                    const isCommentAuthor = store.currentUser?.id === comment.authorUserId;
                    const isEditing = editingCommentId === comment.id;

                    return (
                      <div key={comment.id} className="group flex gap-3">
                        <Avatar className="mt-0.5 h-8 w-8 shrink-0">
                          <AvatarImage src={author?.avatarUrl} />
                          <AvatarFallback>{author?.displayName?.charAt(0) || '?'}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{author?.displayName || 'Unknown User'}</span>
                            <span className="text-[11px] text-muted-foreground">
                              {mounted
                                ? new Date(comment.createdAt).toLocaleString([], {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '...'}
                              {comment.isEdited && <span className="ml-1 italic">(edited)</span>}
                            </span>
                            {isCommentAuthor && !isEditing && (
                              <div className="ml-auto flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-primary"
                                  onClick={() => {
                                    setEditingCommentId(comment.id);
                                    setEditingCommentBody(comment.body);
                                  }}
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                  onClick={() => {
                                    if (confirm('Delete this comment?')) store.deleteComment(task.id, comment.id);
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                          {isEditing ? (
                            <div className="space-y-2">
                              <Textarea
                                value={editingCommentBody}
                                onChange={(e) => setEditingCommentBody(e.target.value)}
                                onKeyDown={(e) => handleKeyDownBullets(e, editingCommentBody, setEditingCommentBody)}
                                className="min-h-[60px] text-sm"
                              />
                              <div className="flex items-center justify-between">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 gap-1.5 px-2 text-muted-foreground"
                                  onClick={() =>
                                    setEditingCommentBody((prev) =>
                                      prev && !prev.endsWith('\n') ? prev + '\n• ' : prev + '• '
                                    )
                                  }
                                >
                                  <List className="h-3.5 w-3.5" />
                                  <span className="text-xs">Bullet</span>
                                </Button>
                                <div className="flex gap-2">
                                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingCommentId(null)}>
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs"
                                    disabled={!editingCommentBody.trim()}
                                    onClick={() => {
                                      store.updateComment(task.id, comment.id, editingCommentBody);
                                      setEditingCommentId(null);
                                    }}
                                  >
                                    Save
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-xl border border-border/40 bg-muted/30 px-3.5 py-2.5 text-sm">
                              {renderCommentBody(comment.body)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-border/50 bg-muted/20 p-3">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={store.currentUser?.avatarUrl} />
                    <AvatarFallback>{store.currentUser?.name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 space-y-2">
                    <Textarea
                      placeholder="Write a comment..."
                      className="min-h-[72px] border-border/40 bg-background text-sm shadow-none"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => handleKeyDownBullets(e, newComment, setNewComment)}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-2 text-muted-foreground"
                        onClick={() =>
                          setNewComment((prev) => (prev && !prev.endsWith('\n') ? prev + '\n• ' : prev + '• '))
                        }
                      >
                        <List className="h-3.5 w-3.5" />
                        Bullet
                      </Button>
                      <Button size="sm" className="h-8 gap-2" onClick={handlePostComment} disabled={!newComment.trim()}>
                        <Send className="h-3.5 w-3.5" />
                        Comment
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="subtasks" className="m-0 px-6 focus-visible:outline-none focus-visible:ring-0">
              <SubtasksTabContent
                task={task}
                store={store}
                projectMembers={eligibleAssignees}
                pipelines={pipelines}
              />
            </TabsContent>

            <TabsContent value="audit" className="m-0 space-y-6 px-6 py-5 focus-visible:outline-none focus-visible:ring-0">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/25 px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-background shadow-sm ring-1 ring-border/50">
                    <Clock3 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Total time logged
                    </p>
                    <p className="text-xl font-semibold tabular-nums tracking-tight">
                      {totalLoggedMs > 0 ? formatDurationMinutes(totalLoggedMs) : '0m'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {timeLogs.length > 0
                        ? `${timeLogs.length} check-out entr${timeLogs.length === 1 ? 'y' : 'ies'}`
                        : 'No daily check-out logs yet'}
                    </p>
                  </div>
                </div>
                {isClosedStatus(pipelines, task.status) && totalLoggedMs > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    Time to complete
                  </Badge>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />
                  Time by day
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal">
                    {timeLogsByDate.length}
                  </span>
                </div>
                {timeLogsByDate.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                    Daily time appears here when someone logs hours at check-out.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {timeLogsByDate.map((day) => (
                      <div
                        key={day.dateKey}
                        className="overflow-hidden rounded-xl border border-border/50 bg-muted/10"
                      >
                        <div className="flex items-center justify-between gap-3 border-b border-border/40 bg-muted/20 px-3.5 py-2.5">
                          <div>
                            <p className="text-sm font-semibold">{day.label}</p>
                            <p className="text-[11px] text-muted-foreground">{day.dateKey}</p>
                          </div>
                          <Badge variant="secondary" className="tabular-nums">
                            {formatDurationMinutes(day.totalMs)}
                          </Badge>
                        </div>
                        <div className="divide-y divide-border/40">
                          {day.entries.map((log) => (
                            <div key={log.id} className="flex items-start justify-between gap-3 px-3.5 py-2.5">
                              <div className="min-w-0">
                                <p className="text-sm font-medium">{log.userName || 'User'}</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {log.description?.trim()
                                    ? log.description.trim()
                                    : 'Logged at check-out'}
                                </p>
                                {log.createdAt && (
                                  <p className="mt-1 text-[11px] text-muted-foreground">
                                    {new Date(log.createdAt).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </p>
                                )}
                              </div>
                              <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                                {formatDurationMinutes(log.durationMs || 0)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  <History className="h-3.5 w-3.5" />
                  Activity
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal">
                    {audits.length}
                  </span>
                </div>
                {audits.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
                    No activity yet. Field changes and check-out logs will show here in detail.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {audits.map((a) => {
                      const fromLabel = formatAuditDisplayValue(a.field, a.fromValue, {
                        memberNames,
                        pipelines,
                      });
                      const toLabel = formatAuditDisplayValue(a.field, a.toValue, {
                        memberNames,
                        pipelines,
                      });
                      const detailMessage =
                        a.message &&
                        !/[A-Za-z0-9_-]{20,}/.test(a.message)
                          ? a.message
                          : a.kind === 'field_change'
                            ? `${a.actorName} changed ${formatAuditFieldLabel(a.field).toLowerCase()} from “${fromLabel}” to “${toLabel}”`
                            : a.message;

                      return (
                        <div key={a.id} className="rounded-xl border border-border/50 bg-muted/15 px-3.5 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <p className="text-sm font-medium">
                                {a.kind === 'created' && 'Task created'}
                                {a.kind === 'field_change' && (
                                  <>{formatAuditFieldLabel(a.field)} updated</>
                                )}
                                {a.kind === 'time_logged' && (
                                  <>Time logged · {formatDurationMinutes(a.durationMs || 0)}</>
                                )}
                              </p>
                              {a.kind === 'field_change' && (
                                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground line-through">
                                    {fromLabel}
                                  </span>
                                  <span className="text-muted-foreground">→</span>
                                  <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-medium text-foreground">
                                    {toLabel}
                                  </span>
                                </div>
                              )}
                              {a.reason && (
                                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5">
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                                    Reason
                                  </p>
                                  <p className="text-xs leading-relaxed text-foreground/90">{a.reason}</p>
                                </div>
                              )}
                              {detailMessage && (
                                <p className="text-xs leading-relaxed text-muted-foreground">{detailMessage}</p>
                              )}
                              <p className="text-[11px] text-muted-foreground">
                                {a.actorName}
                                {a.createdAt
                                  ? ` · ${new Date(a.createdAt).toLocaleString(undefined, {
                                      dateStyle: 'medium',
                                      timeStyle: 'short',
                                    })}`
                                  : ''}
                              </p>
                            </div>
                            <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                              {a.kind === 'field_change'
                                ? 'Change'
                                : a.kind === 'time_logged'
                                  ? 'Time'
                                  : 'Created'}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>

      <ChangeReasonDialog
        open={!!pendingChange}
        pending={pendingChange}
        onOpenChange={(open) => {
          if (!open) setPendingChange(null);
        }}
        onConfirm={confirmMajorChange}
      />
    </Sheet>
  );
}