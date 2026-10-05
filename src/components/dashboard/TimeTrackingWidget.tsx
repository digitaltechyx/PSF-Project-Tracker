"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Coffee, LogIn, LogOut, Play, Timer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  formatAttendanceTime,
  formatDuration,
  formatDurationClock,
  getBreakMs,
  getWorkMs,
  getAttendanceStatus,
  statusLabel,
} from '@/lib/attendance';
import { cn } from '@/lib/utils';

export function TimeTrackingWidget({ store, className }: { store: any; className?: string }) {
  const {
    todayAttendance,
    isAttendanceLoading,
    checkIn,
    checkOut,
    startBreak,
    endBreak,
    activeWorkspace,
    currentUser,
  } = store;
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const status = getAttendanceStatus(todayAttendance);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (status === 'not_checked_in' || status === 'done') return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [status]);

  const workMs = useMemo(() => getWorkMs(todayAttendance, now), [todayAttendance, now]);
  const breakMs = useMemo(() => getBreakMs(todayAttendance, now), [todayAttendance, now]);

  const run = async (fn: () => Promise<{ ok: boolean; reason?: string }>, success: string) => {
    setIsProcessing(true);
    try {
      const result = await fn();
      if (result?.ok) toast({ title: success });
      else if (result?.reason === 'already_checked_in') toast({ title: 'Already checked in' });
      else if (result?.reason === 'already_on_break') toast({ title: 'Already on break' });
      else if (result?.reason === 'not_on_break') toast({ title: 'No active break' });
      else if (result?.reason === 'already_checked_out') toast({ title: 'Already checked out' });
    } catch {
      toast({ variant: 'destructive', title: 'Action failed', description: 'Please try again.' });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isAttendanceLoading && !todayAttendance) {
    return (
      <div className={cn('rounded-2xl border bg-card p-6 shadow-sm', className)}>
        <Skeleton className="h-6 w-40 mb-4" />
        <Skeleton className="h-12 w-48 mb-6" />
        <Skeleton className="h-10 w-full max-w-md" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm',
        'bg-gradient-to-br from-primary/[0.06] via-card to-card',
        className
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none" />
      <div className="relative p-6 md:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Today&apos;s shift
              </span>
              <Badge
                variant={status === 'working' ? 'default' : 'secondary'}
                className={cn(
                  status === 'working' && 'bg-emerald-600 hover:bg-emerald-600',
                  status === 'on_break' && 'bg-amber-500 hover:bg-amber-500 text-white'
                )}
              >
                {statusLabel(status)}
              </Badge>
            </div>

            {status === 'not_checked_in' && (
              <>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                  Ready to start?
                </h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  Check in when you begin work. Use breaks for lunch or pauses — we track work time and break time separately.
                </p>
              </>
            )}

            {(status === 'working' || status === 'on_break') && (
              <>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span
                    className={cn(
                      'text-4xl md:text-5xl font-bold tabular-nums tracking-tight',
                      status === 'on_break' ? 'text-amber-600' : 'text-emerald-600'
                    )}
                  >
                    {formatDurationClock(workMs)}
                  </span>
                  <span className="text-sm text-muted-foreground">work time</span>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Timer className="h-3.5 w-3.5" />
                  In at {formatAttendanceTime(todayAttendance?.checkInTime, mounted)}
                  {breakMs > 0 && <> · Breaks {formatDuration(breakMs)}</>}
                </p>
              </>
            )}

            {status === 'done' && (
              <>
                <div className="text-3xl font-bold tabular-nums">{formatDuration(workMs)}</div>
                <p className="text-sm text-muted-foreground">
                  Work {formatDuration(workMs)} · Break {formatDuration(breakMs)} ·{' '}
                  {formatAttendanceTime(todayAttendance?.checkInTime, mounted)} →{' '}
                  {formatAttendanceTime(todayAttendance?.checkOutTime, mounted)}
                </p>
              </>
            )}
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0 w-full sm:w-auto lg:min-w-[220px]">
            {status === 'not_checked_in' && (
              <Button
                size="lg"
                className="gap-2 shadow-md"
                disabled={isProcessing || !activeWorkspace?.id}
                onClick={() => run(() => checkIn(), 'Checked in — good luck!')}
              >
                <LogIn className="h-4 w-4" />
                Check in
              </Button>
            )}

            {(status === 'working' || status === 'on_break') && (
              <>
                {status === 'working' ? (
                  <Button
                    size="lg"
                    variant="secondary"
                    className="gap-2"
                    disabled={isProcessing}
                    onClick={() => run(() => startBreak(), 'Break started')}
                  >
                    <Coffee className="h-4 w-4" />
                    Start break
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    variant="secondary"
                    className="gap-2 border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
                    disabled={isProcessing}
                    onClick={() => run(() => endBreak(), 'Back to work')}
                  >
                    <Play className="h-4 w-4" />
                    End break
                  </Button>
                )}
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2"
                  disabled={isProcessing}
                  onClick={() =>
                    run(
                      () => checkOut(),
                      `Checked out · ${formatDuration(workMs)} work time logged`
                    )
                  }
                >
                  <LogOut className="h-4 w-4" />
                  Check out
                </Button>
              </>
            )}

            {status === 'done' && (
              <Button size="lg" variant="secondary" disabled className="gap-2">
                Shift complete
              </Button>
            )}
          </div>
        </div>

        {(status === 'working' || status === 'on_break' || status === 'done') && (
          <div className="mt-6 pt-6 border-t border-border/60 grid grid-cols-3 gap-4 max-w-lg">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Work</p>
              <p className="text-lg font-semibold tabular-nums">{formatDuration(workMs)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Break</p>
              <p className="text-lg font-semibold tabular-nums text-amber-700">{formatDuration(breakMs)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total</p>
              <p className="text-lg font-semibold tabular-nums text-muted-foreground">
                {formatDuration(workMs + breakMs)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
