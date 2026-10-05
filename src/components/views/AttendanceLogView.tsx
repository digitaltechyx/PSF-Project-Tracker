"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, LogIn, LogOut, Users, UserRound } from 'lucide-react';
import {
  formatAttendanceDate,
  formatAttendanceTime,
  formatDuration,
  getBreakMs,
  getWorkMs,
  getAttendanceStatus,
  statusLabel,
} from '@/lib/attendance';
import { AttendanceEntry } from '@/lib/types';
import { TimeTrackingWidget } from '@/components/dashboard/TimeTrackingWidget';

export function AttendanceLogView({ store }: { store: any }) {
  const {
    allWorkspaceAttendance,
    isAllAttendanceLoading,
    myAttendanceHistory,
    isMyAttendanceLoading,
    workspaceMembers,
    isAdmin,
  } = store;
  const [mounted, setMounted] = useState(false);
  const [memberFilter, setMemberFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setMounted(true);
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const todayKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const memberMap = useMemo(() => {
    const map = new Map<string, any>();
    (workspaceMembers || []).forEach((m: any) => map.set(m.userId, m));
    return map;
  }, [workspaceMembers]);

  const todayEntries: AttendanceEntry[] = useMemo(
    () => (allWorkspaceAttendance || []).filter((e: AttendanceEntry) => e.dateKey === todayKey),
    [allWorkspaceAttendance, todayKey]
  );

  const presence = useMemo(() => {
    const byUser = new Map(todayEntries.map((e) => [e.userId, e]));
    const members = workspaceMembers || [];
    const working: any[] = [];
    const onBreak: any[] = [];
    const done: any[] = [];
    const away: any[] = [];

    members.forEach((m: any) => {
      const entry = byUser.get(m.userId);
      const status = getAttendanceStatus(entry);
      const row = { member: m, entry, status };
      if (status === 'working') working.push(row);
      else if (status === 'on_break') onBreak.push(row);
      else if (status === 'done') done.push(row);
      else away.push(row);
    });

    return { working, onBreak, done, away };
  }, [todayEntries, workspaceMembers]);

  const filteredHistory = useMemo(() => {
    let rows = [...(allWorkspaceAttendance || [])] as AttendanceEntry[];
    if (memberFilter !== 'all') {
      rows = rows.filter((e) => e.userId === memberFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((e) => {
        const name = memberMap.get(e.userId)?.displayName?.toLowerCase() || '';
        return name.includes(q) || e.dateKey.includes(q);
      });
    }
    return rows.sort((a, b) => {
      if (a.dateKey === b.dateKey) {
        return new Date(b.checkInTime || 0).getTime() - new Date(a.checkInTime || 0).getTime();
      }
      return b.dateKey.localeCompare(a.dateKey);
    });
  }, [allWorkspaceAttendance, memberFilter, search, memberMap]);

  const groupedHistory = useMemo(() => {
    return filteredHistory.reduce((acc: Record<string, AttendanceEntry[]>, entry) => {
      if (!acc[entry.dateKey]) acc[entry.dateKey] = [];
      acc[entry.dateKey].push(entry);
      return acc;
    }, {});
  }, [filteredHistory]);

  const myHistory = useMemo(() => {
    return [...(myAttendanceHistory || [])].sort((a: AttendanceEntry, b: AttendanceEntry) =>
      b.dateKey.localeCompare(a.dateKey)
    );
  }, [myAttendanceHistory]);

  const myWeekTotalMs = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - 6);
    const startKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    return myHistory
      .filter((e: AttendanceEntry) => e.dateKey >= startKey)
      .reduce((sum: number, e: AttendanceEntry) => sum + getWorkMs(e, now), 0);
  }, [myHistory, now]);

  const renderMemberRow = (entry: AttendanceEntry, showName = true) => {
    const member = memberMap.get(entry.userId);
    const status = getAttendanceStatus(entry);
    const work = formatDuration(getWorkMs(entry, now));
    const brk = formatDuration(getBreakMs(entry, now));
    return (
      <div
        key={entry.id}
        className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5"
      >
        <Avatar className="h-9 w-9">
          <AvatarImage src={member?.avatarUrl || undefined} />
          <AvatarFallback className="text-xs">
            {(member?.displayName || '?').charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          {showName && (
            <p className="text-sm font-medium truncate">{member?.displayName || 'Unknown'}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <LogIn className="h-3 w-3" />
              {formatAttendanceTime(entry.checkInTime, mounted)}
            </span>
            {entry.checkOutTime && (
              <span className="inline-flex items-center gap-1">
                <LogOut className="h-3 w-3" />
                {formatAttendanceTime(entry.checkOutTime, mounted)}
              </span>
            )}
            <span className="font-medium text-foreground/80">Work {work}</span>
            {brk !== '0m' && <span className="text-amber-700">Break {brk}</span>}
          </div>
        </div>
        <Badge
          variant={status === 'working' ? 'default' : 'secondary'}
          className={
            status === 'working'
              ? 'bg-emerald-600 hover:bg-emerald-600'
              : status === 'on_break'
                ? 'bg-amber-500 hover:bg-amber-500 text-white'
                : ''
          }
        >
          {statusLabel(status)}
        </Badge>
      </div>
    );
  };

  const memberContent = (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        <TimeTrackingWidget store={store} />
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">My time</p>
                <p className="text-xs text-muted-foreground">Last 7 days · {formatDuration(myWeekTotalMs)}</p>
              </div>
              <UserRound className="h-4 w-4 text-muted-foreground" />
            </div>
            {isMyAttendanceLoading && myHistory.length === 0 ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : myHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No time entries yet.</p>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {myHistory.map((entry: AttendanceEntry) => (
                  <div key={entry.id} className="rounded-lg border border-border/50 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{formatAttendanceDate(entry.dateKey, mounted)}</p>
                      <span className="text-xs font-semibold tabular-nums">
                        {formatDuration(getWorkMs(entry, now))}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatAttendanceTime(entry.checkInTime, mounted)}
                      {entry.checkOutTime
                        ? ` → ${formatAttendanceTime(entry.checkOutTime, mounted)}`
                        : ' · in progress'}
                      {' · '}Work {formatDuration(getWorkMs(entry, now))} · Break{' '}
                      {formatDuration(getBreakMs(entry, now))}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  if (!isAdmin) {
    return (
      <div className="space-y-4 animate-in fade-in duration-300">
        <div>
          <p className="page-subheading">
            Track your work day and review your recent hours.
          </p>
        </div>
        {memberContent}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <p className="page-subheading">
          See who’s working now and review team time entries.
        </p>
      </div>

      <Tabs defaultValue="team">
        <TabsList>
          <TabsTrigger value="team" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Team presence
          </TabsTrigger>
          <TabsTrigger value="mine" className="gap-1.5">
            <UserRound className="h-3.5 w-3.5" />
            My time
          </TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="space-y-6 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border-border/60 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Working</p>
                <p className="text-3xl font-semibold mt-1 text-emerald-600">{presence.working.length}</p>
              </CardContent>
            </Card>
            <Card className="border-border/60 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">On break</p>
                <p className="text-3xl font-semibold mt-1 text-amber-600">{presence.onBreak.length}</p>
              </CardContent>
            </Card>
            <Card className="border-border/60 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Done today</p>
                <p className="text-3xl font-semibold mt-1">{presence.done.length}</p>
              </CardContent>
            </Card>
            <Card className="border-border/60 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Away</p>
                <p className="text-3xl font-semibold mt-1 text-muted-foreground">{presence.away.length}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
            {[
              { title: 'Working', rows: presence.working, empty: 'Nobody is working.' },
              { title: 'On break', rows: presence.onBreak, empty: 'Nobody on break.' },
              { title: 'Completed', rows: presence.done, empty: 'No completed check-outs yet.' },
              { title: 'Away', rows: presence.away, empty: 'Everyone has checked in.' },
            ].map((col) => (
              <Card key={col.title} className="border-border/60 shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm font-semibold">{col.title}</p>
                  {isAllAttendanceLoading && col.rows.length === 0 ? (
                    <Skeleton className="h-16 w-full" />
                  ) : col.rows.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4">{col.empty}</p>
                  ) : (
                    <div className="space-y-2">
                      {col.rows.map((row: any) =>
                        row.entry ? (
                          renderMemberRow(row.entry)
                        ) : (
                          <div
                            key={row.member.userId}
                            className="flex items-center gap-3 rounded-lg border border-dashed border-border/70 px-3 py-2.5"
                          >
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={row.member.avatarUrl || undefined} />
                              <AvatarFallback className="text-xs">
                                {(row.member.displayName || '?').charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <p className="text-sm font-medium">{row.member.displayName}</p>
                              <p className="text-xs text-muted-foreground">Not checked in</p>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-border/60 shadow-sm">
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">History</p>
                  <p className="text-xs text-muted-foreground">Recent check-ins across the workspace</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search member or date"
                    className="h-8 w-[200px] text-sm"
                  />
                  <Select value={memberFilter} onValueChange={setMemberFilter}>
                    <SelectTrigger className="h-8 w-[160px] text-xs">
                      <SelectValue placeholder="Member" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All members</SelectItem>
                      {(workspaceMembers || []).map((m: any) => (
                        <SelectItem key={m.userId} value={m.userId}>
                          {m.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {Object.keys(groupedHistory).length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No attendance records found</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {Object.entries(groupedHistory).map(([dateKey, entries]) => (
                    <div key={dateKey} className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {formatAttendanceDate(dateKey, mounted)}
                      </p>
                      <div className="space-y-2">
                        {(entries as AttendanceEntry[]).map((entry) => renderMemberRow(entry))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mine" className="mt-4">
          {memberContent}
        </TabsContent>
      </Tabs>
    </div>
  );
}
