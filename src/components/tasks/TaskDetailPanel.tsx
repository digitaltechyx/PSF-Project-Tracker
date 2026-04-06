"use client";

import React, { useState, useEffect, useMemo } from 'react';
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
  Send
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { generateTaskDescription } from '@/ai/flows/ai-task-description-generation';
import { suggestTaskAttributes } from '@/ai/flows/ai-task-attribute-suggestion';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';

function SubtaskRow({ subtask, store, projectMembers, isNew, onRemoveNew }: any) {
  const isAdmin = store.isAdmin;
  const [title, setTitle] = useState(subtask.title || '');
  
  useEffect(() => {
    if (isNew) return;
    const timer = setTimeout(() => {
      if (title !== subtask.title) {
        store.updateSubtask(subtask.taskId, subtask.id, { title });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [title, subtask.title, subtask.id, subtask.taskId, store, isNew]);

  const handleSaveNew = () => {
    if (!title.trim()) {
      onRemoveNew();
    } else {
      store.createSubtask(subtask.taskId, subtask.projectId, { title: title.trim(), status: 'todo', priority: 'medium' });
      onRemoveNew();
    }
  };

  return (
    <div className="group border rounded-lg p-3 space-y-3 bg-card hover:border-border transition-colors relative">
      <div className="flex items-center gap-3">
        {!isNew && (
          <Checkbox 
            checked={subtask.status === 'done'} 
            onCheckedChange={(c) => store.updateSubtask(subtask.taskId, subtask.id, { status: c ? 'done' : 'todo' })}
            disabled={!isAdmin}
          />
        )}
        <Input 
          className={cn("h-8 flex-1 font-medium bg-transparent border-transparent hover:border-input focus-visible:ring-1", subtask.status === 'done' && !isNew && "line-through text-muted-foreground opacity-70")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Subtask title..."
          onBlur={isNew ? handleSaveNew : undefined}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
          autoFocus={isNew}
          disabled={!isAdmin && !isNew}
        />
        {!isNew && isAdmin && (
          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => {
            if (confirm("Delete subtask?")) store.deleteSubtask(subtask.taskId, subtask.id);
          }}>
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
      {!isNew && (
        <div className="flex flex-wrap gap-2 items-center pl-6">
          <Select value={subtask.status} onValueChange={(val) => store.updateSubtask(subtask.taskId, subtask.id, { status: val })} disabled={!isAdmin}>
            <SelectTrigger className="h-6 text-[10px] w-auto border-none bg-muted/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todo">To Do</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>

          <Select value={subtask.priority} onValueChange={(val) => store.updateSubtask(subtask.taskId, subtask.id, { priority: val })} disabled={!isAdmin}>
            <SelectTrigger className={cn("h-6 text-[10px] w-auto border-none", 
              subtask.priority === 'urgent' ? 'bg-red-100 text-red-700' : 
              subtask.priority === 'high' ? 'bg-orange-100 text-orange-700' :
              subtask.priority === 'medium' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
            )}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative">
            <Calendar className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
            <Input 
              type="date"
              className="h-6 text-[10px] pl-6 w-auto border-none bg-muted/50"
              value={subtask.dueDate ? subtask.dueDate.split('T')[0] : ''}
              onChange={(e) => store.updateSubtask(subtask.taskId, subtask.id, { dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
              disabled={!isAdmin}
            />
          </div>

          <Select value={subtask.assigneeUserId || 'unassigned'} onValueChange={(val) => store.updateSubtask(subtask.taskId, subtask.id, { assigneeUserId: val === 'unassigned' ? null : val })} disabled={!isAdmin}>
            <SelectTrigger className="h-6 text-[10px] w-auto border-none bg-muted/50 max-w-[120px] truncate">
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {projectMembers.map((m: any) => (
                <SelectItem key={m.userId} value={m.userId}>{m.displayName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

function SubtasksTabContent({ task, store, projectMembers }: any) {
  const [addingNew, setAddingNew] = useState(false);
  const subtasks = store.allWorkspaceSubtasks?.filter((s: any) => s.taskId === task.id) || [];
  
  const completedCount = subtasks.filter((s: any) => s.status === 'done').length;
  const totalCount = subtasks.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-6 py-4">
      <div className="space-y-2">
        <div className="flex justify-between items-center text-sm font-medium">
          <span>{totalCount > 0 ? `${completedCount}/${totalCount} completed` : '0 subtasks'}</span>
          {store.isAdmin && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAddingNew(true)} disabled={addingNew}>
              <Plus className="h-3 w-3 mr-1" /> Add Subtask
            </Button>
          )}
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      {totalCount === 0 && !addingNew && (
        <div className="text-center py-8 text-sm text-muted-foreground bg-muted/20 border border-dashed rounded-xl">
          No subtasks yet. Click &apos;+ Add Subtask&apos; to break this task into smaller pieces.
        </div>
      )}

      <div className="space-y-3">
        {subtasks.map((st: any) => (
          <SubtaskRow key={st.id} subtask={st} store={store} projectMembers={projectMembers} />
        ))}
        {addingNew && (
          <SubtaskRow 
            isNew 
            onRemoveNew={() => setAddingNew(false)} 
            subtask={{ taskId: task.id, projectId: task.projectId }} 
            store={store} 
          />
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const task = useMemo(() => {
    if (!taskId) return null;
    return store.allWorkspaceTasks?.find((t: any) => t.id === taskId);
  }, [taskId, store.allWorkspaceTasks]);

  const taskProject = useMemo(() => {
    if (!task) return null;
    return store.workspaceProjects?.find((p: any) => p.id === task.projectId) || null;
  }, [task, store.workspaceProjects]);

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

  if (!task) return null;

  const isAdmin = store.isAdmin;

  const handleUpdate = (field: string, value: any) => {
    if (!isAdmin) return;
    store.updateTask(taskId, { [field]: value });
  };

  const handleGenerateDescription = async () => {
    if (!isAdmin) return;
    setIsGeneratingDesc(true);
    try {
      const result = await generateTaskDescription({ taskTitle: task.title });
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
      handleUpdate('priority', result.priority);
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

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-4 pb-6 border-b">
          <div className="flex justify-between items-start pt-2">
            <SheetTitle>
              <Badge variant="outline" className="uppercase tracking-widest text-[10px]">
                Task Detail
              </Badge>
            </SheetTitle>
            <div className="flex gap-2">
              {isAdmin && (
                <Button variant="ghost" size="icon" onClick={handleDelete} className="text-destructive h-8 w-8">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <Input 
            className="text-2xl font-bold border-none px-0 shadow-none focus-visible:ring-0 font-headline"
            value={task.title}
            onChange={(e) => handleUpdate('title', e.target.value)}
            disabled={!isAdmin}
          />
        </SheetHeader>

        <Tabs defaultValue="details" className="flex-1 overflow-visible">
          <div className="px-6 border-b">
            <TabsList className="grid w-full max-w-[400px] grid-cols-2 bg-transparent justify-start">
              <TabsTrigger value="details" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none bg-transparent h-10">Details</TabsTrigger>
              <TabsTrigger value="subtasks" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none bg-transparent h-10">Subtasks</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="details" className="m-0 px-6 focus-visible:outline-none focus-visible:ring-0 space-y-8 py-6">
            <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase font-bold tracking-tight">Status</Label>
              <Select value={task.status} onValueChange={(val) => handleUpdate('status', val)} disabled={!isAdmin}>
                <SelectTrigger className="h-9">
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
              <div className="flex justify-between items-center">
                <Label className="text-xs text-muted-foreground uppercase font-bold tracking-tight">Priority</Label>
                {isAdmin && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-5 w-5 text-primary" 
                    onClick={handleSuggestAttributes}
                    disabled={isSuggestingAttrs}
                  >
                    {isSuggestingAttrs ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  </Button>
                )}
              </div>
              <Select value={task.priority} onValueChange={(val) => handleUpdate('priority', val)} disabled={!isAdmin}>
                <SelectTrigger className="h-9">
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
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase font-bold tracking-tight">Due Date</Label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="date" 
                  className="pl-9 h-9" 
                  value={task.dueDate ? task.dueDate.split('T')[0] : ''}
                  onChange={(e) => handleUpdate('dueDate', e.target.value ? new Date(e.target.value).toISOString() : null)}
                  disabled={!isAdmin}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase font-bold tracking-tight">Assignee</Label>
              <Select value={task.assigneeUserId || 'unassigned'} onValueChange={(val) => handleUpdate('assigneeUserId', val === 'unassigned' ? null : val)} disabled={!isAdmin}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {eligibleAssignees.map((m: any) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={m.avatarUrl} />
                          <AvatarFallback>{m.displayName?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        {m.displayName}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-xs text-muted-foreground uppercase font-bold tracking-tight">
                Description
              </Label>
              {isAdmin && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 text-[10px] gap-1.5"
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
              className="min-h-[120px] leading-relaxed resize-none"
              value={task.description}
              onChange={(e) => handleUpdate('description', e.target.value)}
              disabled={!isAdmin}
            />
          </div>

          <div className="space-y-4">
            <Label className="text-xs text-muted-foreground uppercase font-bold tracking-tight">
              Tags
            </Label>
            <div className="flex flex-wrap gap-2">
              {task.tags?.map((tag: string) => (
                <Badge key={tag} variant="secondary" className="gap-1 px-2 py-1">
                  {tag}
                  {isAdmin && (
                    <X 
                      className="h-3 w-3 cursor-pointer hover:text-destructive" 
                      onClick={() => handleUpdate('tags', task.tags.filter((t: string) => t !== tag))}
                    />
                  )}
                </Badge>
              ))}
              {isAdmin && (
                <Button variant="ghost" size="sm" className="h-7 px-2 border border-dashed rounded-full text-xs">
                  <Plus className="h-3 w-3 mr-1" /> Add Tag
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {/* Comments Section */}
          <div className="space-y-6">
            <Label className="text-xs text-muted-foreground uppercase font-bold tracking-tight flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3" /> Comments ({comments.length})
            </Label>

            <div className="space-y-4">
              {comments.map((comment: any) => {
                const author = store.workspaceMembers.find((m: any) => m.userId === comment.authorUserId);
                return (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={author?.avatarUrl} />
                      <AvatarFallback>{author?.displayName?.charAt(0) || '?'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold">{author?.displayName || 'Unknown User'}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {mounted ? new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                        </span>
                      </div>
                      <div className="text-sm bg-muted/40 p-3 rounded-lg border border-transparent hover:border-border transition-colors">
                        {comment.body}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-start gap-3 pt-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={store.currentUser?.avatarUrl} />
                <AvatarFallback>{store.currentUser?.name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <Textarea 
                  placeholder="Write a comment..."
                  className="min-h-[80px] text-sm"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                />
                <div className="flex justify-end">
                  <Button 
                    size="sm" 
                    className="gap-2 h-8"
                    onClick={handlePostComment}
                    disabled={!newComment.trim()}
                  >
                    <Send className="h-3.5 w-3.5" />
                    Comment
                  </Button>
                </div>
              </div>
            </div>
            </div>
          </TabsContent>
          
          <TabsContent value="subtasks" className="m-0 px-6 focus-visible:outline-none focus-visible:ring-0">
            <SubtasksTabContent task={task} store={store} projectMembers={eligibleAssignees} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}