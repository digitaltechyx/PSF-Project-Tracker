"use client";

import React, { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { isTaskClosed } from '@/lib/pipelines';
import type { Task } from '@/lib/types';

type Row = {
  id: string;
  taskId: string;
  hours: string;
  minutes: string;
  description: string;
};

function newRow(): Row {
  return {
    id: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    taskId: '',
    hours: '0',
    minutes: '30',
    description: '',
  };
}

export function CheckoutWorkSummaryDialog({
  open,
  onOpenChange,
  store,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: any;
  onConfirm: (entries: Array<{ taskId: string; durationMinutes: number; description?: string }>) => Promise<void>;
}) {
  const { myTasks, allWorkspaceTasks, workspaceProjects, currentUser } = store;
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [saving, setSaving] = useState(false);

  const inProgressTasks: Task[] = useMemo(() => {
    const uid = currentUser?.id;
    const source: Task[] = (myTasks?.length ? myTasks : allWorkspaceTasks) || [];
    return source.filter((t) => {
      if (!uid) return false;
      if (!t.assigneeUserIds?.includes(uid)) return false;
      if (isTaskClosed(t, workspaceProjects)) return false;
      // Prefer explicit in-progress-ish statuses, but include any open assigned task
      return true;
    });
  }, [myTasks, allWorkspaceTasks, workspaceProjects, currentUser?.id]);

  const handleSubmit = async (skipLogs: boolean) => {
    setSaving(true);
    try {
      if (skipLogs) {
        await onConfirm([]);
      } else {
        const entries = rows
          .map((r) => {
            const h = Math.max(0, parseInt(r.hours || '0', 10) || 0);
            const m = Math.max(0, parseInt(r.minutes || '0', 10) || 0);
            return {
              taskId: r.taskId,
              durationMinutes: h * 60 + m,
              description: r.description.trim(),
            };
          })
          .filter((e) => e.taskId && e.durationMinutes > 0);
        await onConfirm(entries);
      }
      setRows([newRow()]);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>What did you work on?</DialogTitle>
          <DialogDescription>
            Select your open / in-progress tasks and how long you spent on each. This time is added to the task audit trail.
          </DialogDescription>
        </DialogHeader>

        {inProgressTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            You have no open assigned tasks. You can check out without logging task time.
          </p>
        ) : (
          <div className="space-y-4 py-2">
            {rows.map((row, index) => (
              <div key={row.id} className="rounded-xl border border-border/60 p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs text-muted-foreground">Task {index + 1}</Label>
                  {rows.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setRows((r) => r.filter((x) => x.id !== row.id))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <Select
                  value={row.taskId}
                  onValueChange={(v) =>
                    setRows((list) => list.map((x) => (x.id === row.id ? { ...x, taskId: v } : x)))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select in-progress / open task" />
                  </SelectTrigger>
                  <SelectContent>
                    {inProgressTasks.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Hours</Label>
                    <Input
                      type="number"
                      min={0}
                      value={row.hours}
                      onChange={(e) =>
                        setRows((list) =>
                          list.map((x) => (x.id === row.id ? { ...x, hours: e.target.value } : x))
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Minutes</Label>
                    <Input
                      type="number"
                      min={0}
                      max={59}
                      value={row.minutes}
                      onChange={(e) =>
                        setRows((list) =>
                          list.map((x) => (x.id === row.id ? { ...x, minutes: e.target.value } : x))
                        )
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Summary (optional)</Label>
                  <Textarea
                    rows={2}
                    placeholder="What did you do?"
                    value={row.description}
                    onChange={(e) =>
                      setRows((list) =>
                        list.map((x) => (x.id === row.id ? { ...x, description: e.target.value } : x))
                      )
                    }
                  />
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setRows((r) => [...r, newRow()])}
              disabled={rows.length >= inProgressTasks.length}
            >
              <Plus className="h-3.5 w-3.5" />
              Add another task
            </Button>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="outline" onClick={() => handleSubmit(true)} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Skip & check out
          </Button>
          <Button onClick={() => handleSubmit(false)} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save & check out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
