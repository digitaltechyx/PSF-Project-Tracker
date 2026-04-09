"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, LogIn, LogOut, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function AttendanceCard({ store }: { store: any }) {
  const { todayAttendance, isAttendanceLoading, checkIn, checkOut, activeWorkspace, currentUser } = store;
  const [mounted, setMounted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCheckIn = async () => {
    if (!activeWorkspace?.id || !currentUser?.id) return;
    setIsProcessing(true);
    try {
      await checkIn();
      toast({ title: 'Checked in successfully' });
    } catch (error) {
      console.error('Check-in error:', error);
      toast({ 
        variant: 'destructive', 
        title: 'Check-in failed',
        description: 'Please try again.' 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckOut = async () => {
    if (!activeWorkspace?.id || !currentUser?.id) return;
    setIsProcessing(true);
    try {
      await checkOut();
      toast({ title: 'Checked out successfully' });
    } catch (error: any) {
      console.error('Check-out error:', error);
      const isDelayError = error.message?.includes('Must wait at least 8 hours');
      toast({ 
        variant: isDelayError ? 'default' : 'destructive', 
        title: isDelayError ? 'Check-out not available yet' : 'Check-out failed',
        description: error.message || 'Please try again.' 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Determine attendance status
  const getStatus = () => {
    if (!todayAttendance) return 'not_checked_in';
    if (todayAttendance.checkInTime && !todayAttendance.checkOutTime) return 'checked_in';
    if (todayAttendance.checkOutTime) return 'checked_out';
    return 'not_checked_in';
  };

  const status = getStatus();

  const formatTime = (isoString: string) => {
    if (!mounted || !isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isAttendanceLoading && !todayAttendance) {
    return (
      <Card className="shadow-sm border-none">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16 mb-2" />
          <Skeleton className="h-8 w-24" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border-none">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium">Attendance</CardTitle>
        <Clock className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="text-2xl font-bold">
            {status === 'not_checked_in' && (
              <span className="text-muted-foreground">Not checked in</span>
            )}
            {status === 'checked_in' && (
              <span className="text-green-600">
                {formatTime(todayAttendance.checkInTime)}
              </span>
            )}
            {status === 'checked_out' && (
              <span className="text-muted-foreground">
                {formatTime(todayAttendance.checkOutTime)}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {status === 'not_checked_in' && 'Today'}
            {status === 'checked_in' && 'Checked in'}
            {status === 'checked_out' && 'Checked out'}
          </div>
          <div className="pt-2">
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
            {status === 'checked_in' && (
              <Button
                size="sm"
                className="w-full gap-2"
                onClick={handleCheckOut}
                disabled={isProcessing}
              >
                <LogOut className="h-4 w-4" />
                Check out
              </Button>
            )}
            {status === 'checked_out' && (
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-2"
                disabled
              >
                <CheckCircle2 className="h-4 w-4" />
                Done for today
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
