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

        <div className="space-y-8 py-6">
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
        </div>
      </SheetContent>
    </Sheet>
  );
}