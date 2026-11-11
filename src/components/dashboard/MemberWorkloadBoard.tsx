"use client";

import { useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { isTaskClosed } from '@/lib/pipelines';
import { Layers, Box, ListTodo, ChevronDown, ChevronRight } from 'lucide-react';

type ProjectStat = {
  id: string;
  name: string;
  color: string;
  tasksTotal: number;
  tasksDone: number;
  tasksOpen: number;
  completionRate: number;
};

type ProgramStat = {
  id: string;
  name: string;
  color: string;
  projectCount: number;
  tasksTotal: number;
  tasksDone: number;
  projects: ProjectStat[];
};

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
  programs: ProgramStat[];
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
        // Programs explicitly assigned to this member
        for (const prog of programs) {
          if ((prog.assigneeUserIds || []).includes(m.userId)) {
            programIdSet.add(prog.id);
          }
        }
        const programIds = [...programIdSet];

        const programStats = programIds
          .map((programId) => {
            const prog = programById.get(programId) as any;
            if (!prog) return null;
            const isProgramAssignee = (prog.assigneeUserIds || []).includes(m.userId);
            const projectsInProgram = projects.filter((p: any) => p.programId === programId);
            const relatedProjectIds = isProgramAssignee
              ? projectsInProgram.map((p: any) => p.id)
              : projectIds.filter(
                  (pid) => (projectById.get(pid) as any)?.programId === programId
                );

            const projectStats: ProjectStat[] = relatedProjectIds
              .map((pid) => {
                const project = projectById.get(pid) as any;
                if (!project) return null;
                const projectTasks = assigned.filter((t: any) => t.projectId === pid);
                const projectDone = projectTasks.filter((t: any) =>
                  isTaskClosed(t, projects)
                ).length;
                const projectTotal = projectTasks.length;
                return {
                  id: pid,
                  name: project.name,
                  color: project.color || '#64748b',
                  tasksTotal: projectTotal,
                  tasksDone: projectDone,
                  tasksOpen: projectTotal - projectDone,
                  completionRate:
                    projectTotal > 0 ? (projectDone / projectTotal) * 100 : 0,
                } as ProjectStat;
              })
              .filter(Boolean)
              .sort((a, b) => {
                if (!a || !b) return 0;
                if (b.tasksOpen !== a.tasksOpen) return b.tasksOpen - a.tasksOpen;
                if (b.tasksTotal !== a.tasksTotal) return b.tasksTotal - a.tasksTotal;
                return a.name.localeCompare(b.name);
              }) as ProjectStat[];

            const progTasksTotal = projectStats.reduce((sum, p) => sum + p.tasksTotal, 0);
            const progTasksDone = projectStats.reduce((sum, p) => sum + p.tasksDone, 0);

            return {
              id: programId,
              name: prog.name,
              color: prog.color || '#64748b',
              projectCount: projectStats.length,
              tasksTotal: progTasksTotal,
              tasksDone: progTasksDone,
              projects: projectStats,
            } as ProgramStat;
          })
          .filter(Boolean) as ProgramStat[];

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

                          {prog.projects.length > 0 ? (
                            <div className="mt-3 space-y-2">
                              {prog.projects.map((project) => (
                                <button
                                  key={project.id}
                                  type="button"
                                  className="flex w-full items-center gap-3 rounded-lg border border-border/50 bg-white px-2.5 py-2 text-left transition hover:border-primary/40"
                                  onClick={() => onNavigateToProject?.(project.id)}
                                >
                                  <span
                                    className="h-2 w-2 shrink-0 rounded-full"
                                    style={{ backgroundColor: project.color }}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="truncate text-xs font-medium">
                                        {project.name}
                                      </span>
                                      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                                        {project.tasksDone}/{project.tasksTotal} ·{' '}
                                        {Math.round(project.completionRate)}%
                                      </span>
                                    </div>
                                    <Progress
                                      value={project.completionRate}
                                      className="mt-1.5 h-1"
                                    />
                                    <p className="mt-1 text-[10px] text-muted-foreground">
                                      {project.tasksOpen} open · {project.tasksDone} done
                                    </p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-2 text-[11px] text-muted-foreground">
                              No projects linked for this member yet.
                            </p>
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
