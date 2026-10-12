"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Calendar, ListChecks, Loader2, AlertCircle, Target as TargetIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { TargetShare, TargetStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<TargetStatus, string> = {
  planned: 'Planned',
  in_progress: 'In progress',
  done: 'Done',
};

const STATUS_CLASS: Record<TargetStatus, string> = {
  planned: 'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-amber-50 text-amber-800 border-amber-200',
  done: 'bg-emerald-50 text-emerald-800 border-emerald-200',
};

function formatRange(start: string, end: string) {
  try {
    const s = start ? new Date(start + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
    const e = end ? new Date(end + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
    return `${s} → ${e}`;
  } catch {
    return `${start} → ${end}`;
  }
}

export default function SharedTargetPage() {
  const params = useParams();
  const token = params.token as string;
  const db = useFirestore();
  const [share, setShare] = useState<TargetShare | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!db || !token) return;
      setLoading(true);
      setError(null);
      try {
        const snap = await getDoc(doc(db, 'targetShares', token));
        if (!snap.exists()) {
          setError('This share link is invalid or has been disabled.');
          setShare(null);
        } else {
          setShare({ id: snap.id, ...snap.data() } as TargetShare);
        }
      } catch {
        setError('Could not load this shared target.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [db, token]);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-background to-background">
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-16">
        <div className="flex items-center gap-2 text-muted-foreground mb-8">
          <TargetIcon className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-[0.14em]">Shared target · view only</span>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading…
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center">
            <AlertCircle className="h-8 w-8 mx-auto text-destructive mb-3" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        {!loading && share && (
          <article className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
            <div className="p-6 sm:p-8 space-y-4">
              {share.workspaceName && (
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {share.workspaceName}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold font-headline tracking-tight">{share.title}</h1>
                <Badge variant="outline" className={cn('text-[10px]', STATUS_CLASS[share.status])}>
                  {STATUS_LABEL[share.status]}
                </Badge>
              </div>
              {share.description ? (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{share.description}</p>
              ) : null}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {formatRange(share.startDate, share.endDate)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ListChecks className="h-4 w-4" />
                  {(share.subTargets || []).length} sub-target{(share.subTargets || []).length === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            {(share.subTargets || []).length > 0 && (
              <div className="border-t border-border/50 bg-muted/20 px-6 sm:px-8 py-5 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Sub-targets</p>
                {(share.subTargets || []).map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl bg-background border border-border/40 px-3.5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{s.title}</p>
                      <p className="text-[11px] text-muted-foreground">{formatRange(s.startDate, s.endDate)}</p>
                    </div>
                    <Badge variant="outline" className={cn('text-[10px] w-fit', STATUS_CLASS[s.status])}>
                      {STATUS_LABEL[s.status]}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </article>
        )}
      </div>
    </div>
  );
}
