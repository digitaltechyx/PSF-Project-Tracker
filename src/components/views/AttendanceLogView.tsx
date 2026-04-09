"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, LogIn, LogOut, Loader2 } from 'lucide-react';

export function AttendanceLogView({ store }: { store: any }) {
  const { allWorkspaceAttendance, isAllAttendanceLoading, workspaceMembers, isAdmin } = store;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Only workspace admins can view attendance logs.</p>
      </div>
    );
  }

  if (isAllAttendanceLoading && !allWorkspaceAttendance.length) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map(i => (
          <Card key={i} className="shadow-sm border-none">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Sort by date (most recent first)
  const sortedAttendance = [...allWorkspaceAttendance].sort((a: any, b: any) => 
    new Date(b.dateKey).getTime() - new Date(a.dateKey).getTime()
  );

  // Group by date
  const groupedByDate = sortedAttendance.reduce((acc: any, entry: any) => {
    if (!acc[entry.dateKey]) {
      acc[entry.dateKey] = [];
    }
    acc[entry.dateKey].push(entry);
    return acc;
  }, {});

  const getMemberName = (userId: string) => {
    const member = workspaceMembers.find((m: any) => m.userId === userId);
    return member?.displayName || 'Unknown User';
  };

  const formatTime = (isoString: string) => {
    if (!mounted || !isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateKey: string) => {
    if (!mounted || !dateKey) return '';
    const [year, month, day] = dateKey.split('-');
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).toLocaleDateString([], {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Attendance Log</h2>
        <p className="text-muted-foreground">Track check-ins and check-outs for all team members</p>
      </div>

      {Object.keys(groupedByDate).length === 0 ? (
        <Card className="shadow-sm border-none">
          <CardContent className="py-12 text-center">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No attendance records found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByDate).map(([dateKey, entries]: [string, any]) => (
            <div key={dateKey}>
              <h3 className="text-lg font-semibold mb-3">{formatDate(dateKey)}</h3>
              <div className="space-y-2">
                {entries.map((entry: any) => (
                  <Card key={entry.id} className="shadow-sm border-none">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-semibold text-primary">
                            {getMemberName(entry.userId).charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{getMemberName(entry.userId)}</p>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <LogIn className="h-3 w-3" />
                              {formatTime(entry.checkInTime)}
                            </span>
                            {entry.checkOutTime && (
                              <span className="flex items-center gap-1">
                                <LogOut className="h-3 w-3" />
                                {formatTime(entry.checkOutTime)}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge variant={entry.checkOutTime ? "secondary" : "default"}>
                          {entry.checkOutTime ? "Completed" : "Active"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
