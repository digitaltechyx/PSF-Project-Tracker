"use client";

import React, { useState } from 'react';
import { 
  LayoutList, 
  Kanban, 
  Plus, 
  Search,
  MoreHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TaskList } from '../tasks/TaskList';
import { KanbanBoard } from '../tasks/KanbanBoard';
import { TaskDetailPanel } from '../tasks/TaskDetailPanel';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function ProjectView({ store }: { store: any }) {
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');

  const activeProject = store.activeProject;
  
  // Use globally filtered tasks from the store
  const filteredTasks = store.projectTasks;

  const handleCreateTask = () => {
    if (newTaskTitle && activeProject) {
      store.createTask(activeProject.id, newTaskTitle, newTaskDesc);
      setNewTaskTitle('');
      setNewTaskDesc('');
      setIsCreateTaskOpen(false);
    }
  };

  if (!activeProject) return null;

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-md">
          <Button 
            variant={view === 'list' ? 'secondary' : 'ghost'} 
            size="sm" 
            className="h-8 gap-2"
            onClick={() => setView('list')}
          >
            <LayoutList className="h-4 w-4" />
            List
          </Button>
          <Button 
            variant={view === 'kanban' ? 'secondary' : 'ghost'} 
            size="sm" 
            className="h-8 gap-2"
            onClick={() => setView('kanban')}
          >
            <Kanban className="h-4 w-4" />
            Board
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Dialog open={isCreateTaskOpen} onOpenChange={setIsCreateTaskOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2 h-8">
                <Plus className="h-4 w-4" />
                Add Task
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Task Title</Label>
                  <Input 
                    placeholder="E.g. Design homepage hero" 
                    value={newTaskTitle} 
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea 
                    placeholder="What needs to be done?" 
                    value={newTaskDesc}
                    onChange={(e) => setNewTaskDesc(e.target.value)}
                    rows={4}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateTaskOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateTask}>Create Task</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          <Button variant="outline" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {view === 'list' ? (
          <TaskList 
            tasks={filteredTasks} 
            onTaskClick={(id) => setSelectedTaskId(id)} 
            updateTask={store.updateTask}
          />
        ) : (
          <KanbanBoard 
            tasks={filteredTasks} 
            onTaskClick={(id) => setSelectedTaskId(id)} 
            updateTask={store.updateTask}
          />
        )}
      </div>

      {selectedTaskId && (
        <TaskDetailPanel 
          taskId={selectedTaskId} 
          isOpen={!!selectedTaskId} 
          onClose={() => setSelectedTaskId(null)} 
          store={store}
        />
      )}
    </div>
  );
}
