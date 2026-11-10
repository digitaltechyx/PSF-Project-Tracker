"use client";

import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { FolderInput, Loader2 } from 'lucide-react';

export function MoveTaskDialog({
  open,
  onOpenChange,
  store,
  task,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: any;
  task: { id: string; title?: string; projectId: string } | null;
}) {
  const { toast } = useToast();
  const programs = store.workspacePrograms || [];
  const projects = store.workspaceProjects || [];

  const currentProject = useMemo(
    () => projects.find((p: any) => p.id === task?.projectId) || null,
    [projects, task?.projectId]
  );

  const [programId, setProgramId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !task) return;
    const prog =
      currentProject?.programId ||
      programs[0]?.id ||
      '';
    setProgramId(prog);
    setProjectId(task.projectId);
  }, [open, task, currentProject?.programId, programs]);

  const projectsInProgram = useMemo(
    () => projects.filter((p: any) => p.programId === programId),
    [projects, programId]
  );

  useEffect(() => {
    if (!open) return;
    if (projectsInProgram.some((p: any) => p.id === projectId)) return;
    setProjectId(projectsInProgram[0]?.id || '');
  }, [open, projectsInProgram, projectId]);

  const handleMove = async () => {
    if (!task || !projectId) return;
    if (projectId === task.projectId) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    try {
      await store.moveTask(task.id, projectId);
      const dest = projects.find((p: any) => p.id === projectId);
      const prog = programs.find((pr: any) => pr.id === dest?.programId);
      toast({
        title: 'Task moved',
        description: prog
          ? `Moved to ${prog.name} / ${dest?.name || 'project'}.`
          : `Moved to ${dest?.name || 'project'}.`,
      });
      onOpenChange(false);
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Could not move task',
        description: e?.message || 'Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <FolderInput className="h-5 w-5" />
          </div>
          <DialogTitle>Move task</DialogTitle>
          <DialogDescription>
            Move{task?.title ? ` “${task.title}”` : ' this task'} to another project — including
            projects in a different program.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Program</Label>
            <Select value={programId} onValueChange={setProgramId}>
              <SelectTrigger>
                <SelectValue placeholder="Select program" />
              </SelectTrigger>
              <SelectContent>
                {programs.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Project</Label>
            <Select value={projectId} onValueChange={setProjectId} disabled={!projectsInProgram.length}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projectsInProgram.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {p.id === task?.projectId ? ' (current)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!projectsInProgram.length && (
              <p className="text-xs text-muted-foreground">No projects in this program yet.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleMove()}
            disabled={saving || !projectId || projectId === task?.projectId}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Move task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
