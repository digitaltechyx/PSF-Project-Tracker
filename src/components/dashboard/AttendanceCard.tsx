"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, LogIn, LogOut, CheckCircle2, Timer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  formatAttendanceTime,
  formatDuration,
  formatDurationClock,
  getAttendanceDurationMs,
  getAttendanceStatus,
} from '@/lib/attendance';

export function AttendanceCard({ store }: { store: any }) {
  const { todayAttendance, isAttendanceLoading, checkIn, checkOut, activeWorkspace, currentUser } = store;
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const status = getAttendanceStatus(todayAttendance);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (status !== 'working') return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [status]);

  const durationMs = useMemo(
    () => getAttendanceDurationMs(todayAttendance, now),
    [todayAttendance, now]
  );

  const handleCheckIn = async () => {
    if (!activeWorkspace?.id || !currentUser?.id) return;
    setIsProcessing(true);
    try {
      const result = await checkIn();
      if (result?.ok) {
        toast({ title: 'Checked in', description: 'Your work day has started.' });
      } else if (result?.reason === 'already_checked_in') {
        toast({ title: 'Already checked in', description: 'You already started today.' });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Check-in failed',
        description: 'Please try again.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckOut = async () => {
    if (!activeWorkspace?.id || !currentUser?.id) return;
    setIsProcessing(true);
    try {
      const result = await checkOut();
      if (result?.ok) {
        toast({
          title: 'Checked out',
          description: `Logged ${formatDuration(durationMs)} today.`,
        });
      } else if (result?.reason === 'already_checked_out') {
        toast({ title: 'Already checked out' });
      } else if (result?.reason === 'not_checked_in') {
        toast({ title: 'Not checked in yet' });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Check-out failed',
        description: 'Please try again.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isAttendanceLoading && !todayAttendance) {
    return (
      <Card className="shadow-sm border-border/60">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border-border/60 bg-gradient-to-br from-card to-muted/20">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium tracking-tight">Time tracking</CardTitle>
        <Clock className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            {status === 'not_checked_in' && (
              <>
                <div className="text-xl font-semibold text-muted-foreground">Not started</div>
                <p className="text-xs text-muted-foreground mt-1">Check in to start tracking today</p>
              </>
            )}
            {status === 'working' && (
              <>
                <div className="text-2xl font-semibold tabular-nums tracking-tight text-emerald-600">
                  {formatDurationClock(durationMs)}
                </div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Timer className="h-3 w-3" />
                  In since {formatAttendanceTime(todayAttendance?.checkInTime, mounted)}
                </p>
              </>
            )}
            {status === 'done' && (
              <>
                <div className="text-xl font-semibold tabular-nums">{formatDuration(durationMs)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatAttendanceTime(todayAttendance?.checkInTime, mounted)}
                  {' → '}
                  {formatAttendanceTime(todayAttendance?.checkOutTime, mounted)}
                </p>
              </>
            )}
          </div>
          <Badge
            variant={status === 'working' ? 'default' : 'secondary'}
            className={
              status === 'working'
                ? 'bg-emerald-600 hover:bg-emerald-600'
                : status === 'done'
                  ? ''
                  : 'text-muted-foreground'
            }
          >
            {status === 'not_checked_in' && 'Away'}
            {status === 'working' && 'Working'}
            {status === 'done' && 'Done'}
          </Badge>
        </div>

        {status === 'not_checked_in' && (
          <Button
            size="sm"
            className="w-full gap-2"
            onClick={handleCheckIn}
            disabled={isProcessing || !activeWorkspace?.id}
          >
            <LogIn className="h-4 w-4" />
            Check in
          </Button>
        )}
        {status === 'working' && (
          <Button
            size="sm"
            variant="outline"
            className="w-full gap-2"
            onClick={handleCheckOut}
            disabled={isProcessing}
          >
            <LogOut className="h-4 w-4" />
            Check out
          </Button>
        )}
        {status === 'done' && (
          <Button size="sm" variant="secondary" className="w-full gap-2" disabled>
            <CheckCircle2 className="h-4 w-4" />
            Completed for today
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
