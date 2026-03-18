"use client";

import React from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Task, Priority, Status } from '@/lib/types';
import { 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  MoreVertical 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

const priorityColors: Record<Priority, string> = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

const statusIcons: Record<Status, React.ReactNode> = {
  todo: <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />,
  in_progress: <Clock className="h-4 w-4 text-accent animate-pulse" />,
  done: <CheckCircle2 className="h-4 w-4 text-green-500" />,
};

export function TaskList({ 
  tasks, 
  onTaskClick, 
  updateTask 
}: { 
  tasks: Task[], 
  onTaskClick: (id: string) => void,
  updateTask: any
}) {
  return (
    <div className="bg-card rounded-lg border overflow-hidden shadow-sm">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow>
            <TableHead className="w-[40px]"></TableHead>
            <TableHead className="min-w-[300px]">Task Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead className="text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow 
              key={task.id} 
              className="cursor-pointer group hover:bg-muted/50"
              onClick={() => onTaskClick(task.id)}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox 
                  checked={task.status === 'done'} 
                  onCheckedChange={(checked) => {
                    updateTask(task.id, { status: checked ? 'done' : 'todo' });
                  }}
                />
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className={cn(
                    "font-medium",
                    task.status === 'done' && "line-through text-muted-foreground"
                  )}>
                    {task.title}
                  </span>
                  {task.tags && task.tags.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {task.tags.map(tag => (
                        <span key={tag} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {statusIcons[task.status]}
                  <span className="text-xs capitalize text-muted-foreground">{task.status.replace('_', ' ')}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={cn("capitalize border-none", priorityColors[task.priority])}>
                  {task.priority}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {tasks.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                No tasks match your criteria.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}