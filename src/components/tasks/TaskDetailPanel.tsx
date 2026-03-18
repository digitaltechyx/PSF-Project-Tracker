"use client";

import React, { useState } from 'react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetClose 
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
  User as UserIcon, 
  Tag as TagIcon, 
  Trash2, 
  X,
  Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { generateTaskDescription } from '@/ai/flows/ai-task-description-generation';
import { suggestTaskAttributes } from '@/ai/flows/ai-task-attribute-suggestion';
import { useToast } from '@/hooks/use-toast';

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
  const task = store.tasks.find((t: any) => t.id === taskId);
  const { toast } = useToast();
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [isSuggestingAttrs, setIsSuggestingAttrs] = useState(false);

  if (!task) return null;

  const handleUpdate = (field: string, value: any) => {
    store.updateTask(taskId, { [field]: value });
  };

  const handleGenerateDescription = async () => {
    setIsGeneratingDesc(true);
    try {
      const result = await generateTaskDescription({ taskTitle: task.title });
      handleUpdate('description', result.taskDescription);
      toast({ title: 'AI Description Generated', description: 'Task description has been updated.' });
    } catch (error) {
      console.error(error);
    } finally {
      setIsGeneratingDesc(false);
    }
  };

  const handleSuggestAttributes = async () => {
    setIsSuggestingAttrs(true);
    try {
      const result = await suggestTaskAttributes({ title: task.title, description: task.description });
      handleUpdate('priority', result.priority);
      handleUpdate('tags', result.tags);
      toast({ title: 'AI Attributes Suggested', description: 'Priority and tags have been optimized.' });
    } catch (error) {
      console.error(error);
    } finally {
      setIsSuggestingAttrs(false);
    }
  };

  const handleDelete = () => {
    store.deleteTask(taskId);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-4 pb-6 border-b">
          <div className="flex justify-between items-start pt-2">
            <Badge variant="outline" className="uppercase tracking-widest text-[10px]">
              Task Detail
            </Badge>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={handleDelete} className="text-destructive h-8 w-8">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Input 
            className="text-2xl font-bold border-none px-0 shadow-none focus-visible:ring-0 font-headline"
            value={task.title}
            onChange={(e) => handleUpdate('title', e.target.value)}
          />
        </SheetHeader>

        <div className="space-y-8 py-6">
          {/* Attributes Grid */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase font-bold tracking-tight">Status</Label>
              <Select value={task.status} onValueChange={(val) => handleUpdate('status', val)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs text-muted-foreground uppercase font-bold tracking-tight">Priority</Label>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-5 w-5 text-primary" 
                  onClick={handleSuggestAttributes}
                  disabled={isSuggestingAttrs}
                >
                  {isSuggestingAttrs ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                </Button>
              </div>
              <Select value={task.priority} onValueChange={(val) => handleUpdate('priority', val)}>
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
                  onChange={(e) => handleUpdate('dueDate', new Date(e.target.value).toISOString())}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase font-bold tracking-tight">Assignee</Label>
              <Select value={task.assigneeUserId} onValueChange={(val) => handleUpdate('assigneeUserId', val)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  {store.workspaceMembers.map((m: any) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-3 w-3" />
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
              <Label className="text-xs text-muted-foreground uppercase font-bold tracking-tight flex items-center gap-1.5">
                Description
              </Label>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 text-[10px] gap-1.5 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
                onClick={handleGenerateDescription}
                disabled={isGeneratingDesc}
              >
                {isGeneratingDesc ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                AI Generate
              </Button>
            </div>
            <Textarea 
              placeholder="Add details about this task..."
              className="min-h-[150px] leading-relaxed resize-none"
              value={task.description}
              onChange={(e) => handleUpdate('description', e.target.value)}
            />
          </div>

          <div className="space-y-4">
            <Label className="text-xs text-muted-foreground uppercase font-bold tracking-tight flex items-center gap-1.5">
              <TagIcon className="h-3 w-3" /> Tags
            </Label>
            <div className="flex flex-wrap gap-2">
              {task.tags?.map((tag: string) => (
                <Badge key={tag} variant="secondary" className="gap-1 px-2 py-1">
                  {tag}
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-destructive" 
                    onClick={() => handleUpdate('tags', task.tags.filter((t: string) => t !== tag))}
                  />
                </Badge>
              ))}
              <Button variant="ghost" size="sm" className="h-7 px-2 border border-dashed rounded-full text-xs">
                <Plus className="h-3 w-3 mr-1" /> Add Tag
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}