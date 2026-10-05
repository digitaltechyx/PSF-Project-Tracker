"use client";

import React, { useEffect, useState } from 'react';
import { Pipeline } from '@/lib/types';
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
import { Switch } from '@/components/ui/switch';
import { Trash2, GripVertical, Plus } from 'lucide-react';
import {
  STATUS_COLOR_PRESETS,
  createUniqueStatusId,
  DEFAULT_PIPELINES,
} from '@/lib/pipelines';
import { cn } from '@/lib/utils';

type Draft = Pipeline & { _key: string };

export function ManageStatusesDialog({
  open,
  onOpenChange,
  pipelines,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelines: Pipeline[];
  onSave: (pipelines: Pipeline[]) => Promise<void> | void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const source = pipelines.length ? pipelines : DEFAULT_PIPELINES;
    setDrafts(source.map((p, i) => ({ ...p, _key: `${p.id}-${i}` })));
    setError('');
  }, [open, pipelines]);

  const updateDraft = (key: string, patch: Partial<Pipeline>) => {
    setDrafts((prev) => prev.map((d) => (d._key === key ? { ...d, ...patch } : d)));
  };

  const addStatus = () => {
    const name = 'New status';
    const withoutKey = drafts.map(({ _key, ...rest }) => rest);
    const id = createUniqueStatusId(name, withoutKey);
    setDrafts((prev) => [
      ...prev,
      {
        _key: `new-${Date.now()}`,
        id,
        name,
        color: STATUS_COLOR_PRESETS[prev.length % STATUS_COLOR_PRESETS.length],
        category: 'open',
      },
    ]);
  };

  const removeStatus = (key: string) => {
    if (drafts.length <= 1) {
      setError('Keep at least one status.');
      return;
    }
    setDrafts((prev) => prev.filter((d) => d._key !== key));
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= drafts.length) return;
    setDrafts((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(next, 0, item);
      return copy;
    });
  };

  const handleSave = async () => {
    const cleaned = drafts
      .map(({ _key, ...p }) => ({
        ...p,
        name: (p.name || '').trim(),
        color: p.color || '#94a3b8',
        category: p.category === 'closed' ? ('closed' as const) : ('open' as const),
      }))
      .filter((p) => p.name);

    if (cleaned.length === 0) {
      setError('Add at least one named status.');
      return;
    }
    if (!cleaned.some((p) => p.category === 'closed')) {
      cleaned[cleaned.length - 1].category = 'closed';
    }

    setSaving(true);
    setError('');
    try {
      await onSave(cleaned);
      onOpenChange(false);
    } catch {
      setError('Could not save statuses. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Board statuses</DialogTitle>
          <DialogDescription>
            Customize columns for this project. Closed statuses mark tasks as complete.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1">
          {drafts.map((draft, index) => (
            <div
              key={draft._key}
              className="flex items-start gap-2 rounded-xl border bg-card p-3 shadow-sm"
            >
              <div className="flex flex-col gap-1 pt-1">
                <button
                  type="button"
                  className="h-5 w-5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  title="Move up"
                >
                  <GripVertical className="h-4 w-4 rotate-90" />
                </button>
              </div>

              <div className="flex-1 space-y-3 min-w-0">
                <div className="flex gap-2">
                  <Input
                    value={draft.name}
                    onChange={(e) => updateDraft(draft._key, { name: e.target.value })}
                    className="h-9 font-medium"
                    placeholder="Status name"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => removeStatus(draft._key)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {STATUS_COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateDraft(draft._key, { color: c })}
                      className={cn(
                        'h-5 w-5 rounded-full border-2 transition-transform',
                        draft.color === c ? 'border-foreground scale-110' : 'border-transparent'
                      )}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor={`closed-${draft._key}`} className="text-xs text-muted-foreground">
                    Closed / Done status
                  </Label>
                  <Switch
                    id={`closed-${draft._key}`}
                    checked={draft.category === 'closed'}
                    onCheckedChange={(checked) =>
                      updateDraft(draft._key, { category: checked ? 'closed' : 'open' })
                    }
                  />
                </div>
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" className="w-full gap-2" onClick={addStatus}>
            <Plus className="h-4 w-4" />
            Add status
          </Button>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save statuses'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
