"use client";

import { useEffect, useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';

export type PendingMajorChange = {
  title: string;
  description?: string;
  payload: Record<string, unknown>;
};

export function ChangeReasonDialog({
  open,
  pending,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  pending: PendingMajorChange | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open, pending?.title]);

  const trimmed = reason.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{pending?.title || 'Confirm change'}</DialogTitle>
          <DialogDescription>
            {pending?.description ||
              'A reason is required for this change and will appear in the audit trail.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="change-reason" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Reason <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="change-reason"
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this being changed?"
            className="min-h-[96px] resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && trimmed) {
                e.preventDefault();
                onConfirm(trimmed);
              }
            }}
          />
          <p className="text-[11px] text-muted-foreground">Ctrl/Cmd + Enter to save</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!trimmed}
            onClick={() => {
              if (!trimmed) return;
              onConfirm(trimmed);
            }}
          >
            Save change
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
