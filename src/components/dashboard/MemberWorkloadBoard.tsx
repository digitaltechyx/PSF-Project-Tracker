"use client";

import { useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { isTaskClosed } from '@/lib/pipelines';
import { Layers, Box, ListTodo, ChevronDown, ChevronRight } from 'lucide-react';

type MemberRow = {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl?: string | null;
  tasksTotal: number;
  tasksDone: number;
  tasksOpen: number;
  completionRate: number;
  projectIds: string[];
  programIds: string[];
  programs: Array<{
    id: string;
    name: string;
    color: string;
    projectCount: number;
    tasksTotal: number;
    tasksDone: number;
  }>;
};

export function MemberWorkloadBoard({
  store,
  onNavigateToProgram,
  onNavigateToProject,
}: {
  store: any;
  onNavigateToProgram?: (programId: string) => void;
  onNavigateToProject?: (projectId: string) => void;
}) {
  const {
    workspaceMembers,
    workspacePrograms,
    workspaceProjects,
    allWorkspaceTasks,
  } = store;

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const rows: MemberRow[] = useMemo(() => {
    const members = workspaceMembers || [];
    const programs = workspacePrograms || [];
    const projects = workspaceProjects || [];
    const tasks = allWorkspaceTasks || [];
    const programById = new Map(programs.map((p: any) => [p.id, p]));
    const projectById = new Map(projects.map((p: any) => [p.id, p]));

    return members
      .map((m: any) => {
        const assigned = tasks.filter((t: any) =>
          (t.assigneeUserIds || []).includes(m.userId)
        );
        const done = assigned.filter((t: any) => isTaskClosed(t, projects)).length;
        const open = assigned.length - done;
        const projectIdSet = new Set<string>(
          assigned.map((t: any) => t.projectId).filter(Boolean)
        );
        // Also count projects the member can access
        for (const p of projects) {
          if ((p.allowedUserIds || []).includes(m.userId)) projectIdSet.add(p.id);
        }
        const projectIds = [...projectIdSet];
        const programIdSet = new Set<string>();
        for (const pid of projectIds) {
          const proj = projectById.get(pid) as any;
          if (proj?.programId) programIdSet.add(proj.programId);
        }
        const programIds = [...programIdSet];

        const programStats = programIds
          .map((programId) => {
            const prog = programById.get(programId) as any;
            if (!prog) return null;
            const progProjectIds = projectIds.filter(
              (pid) => (projectById.get(pid) as any)?.programId === programId
            );
            const progTasks = assigned.filter((t: any) =>
              progProjectIds.includes(t.projectId)
            );
            const progDone = progTasks.filter((t: any) =>
              isTaskClosed(t, projects)
            ).length;
            return {
              id: programId,
              name: prog.name,
              color: prog.color || '#64748b',
              projectCount: progProjectIds.length,
              tasksTotal: progTasks.length,
              tasksDone: progDone,
            };
          })
          .filter(Boolean) as MemberRow['programs'];

        return {
          userId: m.userId,
          displayName: m.displayName || m.email || 'Member',
          email: m.email || '',
          avatarUrl: m.avatarUrl,
          tasksTotal: assigned.length,
          tasksDone: done,
          tasksOpen: open,
          completionRate: assigned.length > 0 ? (done / assigned.length) * 100 : 0,
          projectIds,
          programIds,
          programs: programStats.sort((a, b) => b.tasksTotal - a.tasksTotal),
        } as MemberRow;
      })
      .sort((a: MemberRow, b: MemberRow) => {
        if (b.tasksOpen !== a.tasksOpen) return b.tasksOpen - a.tasksOpen;
        return b.tasksTotal - a.tasksTotal;
      });
  }, [workspaceMembers, workspacePrograms, workspaceProjects, allWorkspaceTasks]);

  const projectById = useMemo(() => {
    const map = new Map<string, any>();
    for (const p of workspaceProjects || []) map.set(p.id, p);
    return map;
  }, [workspaceProjects]);

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
        No workspace members yet.
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-card shadow-sm">
      <div className="border-b border-border/60 px-5 py-4 md:px-6">
        <h3 className="text-base font-semibold tracking-tight">Team assignment & completion</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Who is assigned to which programs and projects, and how much they have completed.
        </p>
      </div>

      <div className="divide-y divide-border/60">
        {rows.map((row) => {
          const isOpen = !!expanded[row.userId];
          return (
            <div key={row.userId} className="px-5 py-4 md:px-6">
              <button
                type="button"
                className="flex w-full items-start gap-3 text-left"
                onClick={() =>
                  setExpanded((prev) => ({ ...prev, [row.userId]: !prev[row.userId] }))
                }
              >
                <span className="mt-2 text-muted-foreground">
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </span>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={row.avatarUrl || undefined} />
                  <AvatarFallback>{row.displayName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{row.displayName}</p>
                      <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <Layers className="h-3 w-3" />
                        {row.programIds.length} programs
                      </Badge>
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <Box className="h-3 w-3" />
                        {row.projectIds.length} projects
                      </Badge>
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        <ListTodo className="h-3 w-3" />
                        {row.tasksDone}/{row.tasksTotal} tasks
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>
                        {row.tasksOpen} open · {row.tasksDone} done
                      </span>
                      <span className="tabular-nums font-medium text-foreground">
                        {Math.round(row.completionRate)}%
                      </span>
                    </div>
                    <Progress value={row.completionRate} className="h-1.5" />
                  </div>
                </div>
              </button>

              {isOpen && (
                <div className="mt-4 ml-7 space-y-3 border-l border-border/60 pl-4">
                  {row.programs.length === 0 && row.tasksTotal === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No assigned tasks or project access yet.
                    </p>
                  ) : row.programs.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Assigned work is not linked to a program yet.
                    </p>
                  ) : (
                    row.programs.map((prog) => {
                      const rate =
                        prog.tasksTotal > 0
                          ? (prog.tasksDone / prog.tasksTotal) * 100
                          : 0;
                      const projectsInProg = row.projectIds
                        .map((id) => projectById.get(id))
                        .filter((p) => p && p.programId === prog.id);
                      return (
                        <div
                          key={prog.id}
                          className="rounded-xl border border-border/60 bg-slate-50/70 p-3"
                        >
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-2 text-left"
                            onClick={() => onNavigateToProgram?.(prog.id)}
                          >
                            <span className="inline-flex min-w-0 items-center gap-2">
                              <Layers
                                className="h-3.5 w-3.5 shrink-0"
                                style={{ color: prog.color }}
                              />
                              <span className="truncate text-sm font-semibold">{prog.name}</span>
                            </span>
                            <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                              {prog.projectCount} projects · {prog.tasksDone}/{prog.tasksTotal}{' '}
                              tasks · {Math.round(rate)}%
                            </span>
                          </button>
                          <Progress value={rate} className="mt-2 h-1" />
                          {projectsInProg.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {projectsInProg.map((p: any) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  className={cn(
                                    'inline-flex items-center gap-1 rounded-full border border-border/60 bg-white px-2 py-0.5 text-[11px] hover:border-primary/40'
                                  )}
                                  onClick={() => onNavigateToProject?.(p.id)}
                                >
                                  <span
                                    className="h-1.5 w-1.5 rounded-full"
                                    style={{ backgroundColor: p.color }}
                                  />
                                  {p.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
