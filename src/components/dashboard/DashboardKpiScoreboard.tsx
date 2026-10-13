"use client";

import type { ComponentType } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  CalendarRange,
  CheckCircle2,
  Crosshair,
  FolderKanban,
  ListTodo,
  TrendingUp,
} from 'lucide-react';

type KpiTone = 'slate' | 'emerald' | 'blue' | 'amber' | 'rose' | 'violet';

const toneStyles: Record<
  KpiTone,
  { icon: string; value: string; bar: string; soft: string }
> = {
  slate: {
    icon: 'bg-slate-100 text-slate-700',
    value: 'text-slate-900',
    bar: 'bg-slate-700',
    soft: 'from-slate-50 to-white',
  },
  emerald: {
    icon: 'bg-emerald-50 text-emerald-700',
    value: 'text-emerald-800',
    bar: 'bg-emerald-500',
    soft: 'from-emerald-50/80 to-white',
  },
  blue: {
    icon: 'bg-sky-50 text-sky-700',
    value: 'text-sky-800',
    bar: 'bg-sky-500',
    soft: 'from-sky-50/80 to-white',
  },
  amber: {
    icon: 'bg-amber-50 text-amber-800',
    value: 'text-amber-900',
    bar: 'bg-amber-500',
    soft: 'from-amber-50/80 to-white',
  },
  rose: {
    icon: 'bg-rose-50 text-rose-700',
    value: 'text-rose-800',
    bar: 'bg-rose-500',
    soft: 'from-rose-50/80 to-white',
  },
  violet: {
    icon: 'bg-indigo-50 text-indigo-700',
    value: 'text-indigo-800',
    bar: 'bg-indigo-500',
    soft: 'from-indigo-50/80 to-white',
  },
};

function RingProgress({
  value,
  size = 72,
  stroke = 7,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-slate-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="text-emerald-500 transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="text-sm font-bold tabular-nums text-slate-900">{Math.round(pct)}%</span>
      </div>
    </div>
  );
}

function KpiTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'slate',
  progress,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  tone?: KpiTone;
  progress?: number;
}) {
  const styles = toneStyles[tone];
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br p-4 shadow-sm',
        styles.soft
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            {label}
          </p>
          <p className={cn('mt-2 text-3xl font-semibold tracking-tight tabular-nums', styles.value)}>
            {value}
          </p>
          {hint && <p className="mt-1 text-xs leading-5 text-slate-600">{hint}</p>}
        </div>
        <div className={cn('grid h-10 w-10 place-items-center rounded-xl', styles.icon)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      {typeof progress === 'number' && (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200/80">
          <div
            className={cn('h-full rounded-full transition-all duration-700', styles.bar)}
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function DashboardKpiScoreboard({
  delivery,
  targets,
  showTargets,
  workspaceName,
}: {
  delivery: {
    projects: number;
    tasks: number;
    open: number;
    done: number;
    completionRate: number;
    overdue: number;
    urgent: number;
    dueToday: number;
  };
  targets?: {
    total: number;
    open: number;
    dueThisMonth: number;
    overdue: number;
    completed: number;
    completionRate: number;
  };
  showTargets?: boolean;
  workspaceName?: string;
}) {
  const critical = delivery.overdue + delivery.urgent;
  const deliveryHealth = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        delivery.tasks === 0
          ? 100
          : delivery.completionRate * 0.65 +
              (delivery.open === 0
                ? 35
                : Math.max(0, 35 - (critical / delivery.open) * 35))
      )
    )
  );

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-card shadow-sm">
      <div className="border-b border-border/60 bg-[linear-gradient(135deg,hsl(225_24%_98%),hsl(250_40%_98%),hsl(225_24%_97%))] px-5 py-5 md:px-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              Workspace scoreboard
            </div>
            <h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
              {workspaceName ? `${workspaceName} analytics` : 'Delivery analytics'}
            </h3>
            <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">
              Live KPIs for tasks, projects
              {showTargets ? ', and targets' : ''} — so the team can see progress and risk at a glance.
            </p>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-border/70 bg-white/90 px-4 py-3 shadow-sm">
            <RingProgress value={deliveryHealth} />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Delivery health
              </p>
              <p className="mt-1 text-sm font-medium text-slate-800">
                {deliveryHealth >= 75
                  ? 'On track'
                  : deliveryHealth >= 45
                    ? 'Needs attention'
                    : 'At risk'}
              </p>
              <p className="mt-0.5 text-xs text-slate-600">
                {delivery.done}/{delivery.tasks || 0} tasks complete
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5 md:p-6">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Delivery KPIs
            </p>
            <p className="text-xs text-slate-500">
              {delivery.dueToday} due today · {critical} critical
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <KpiTile
              label="Projects"
              value={delivery.projects}
              hint="Active workspace projects"
              icon={FolderKanban}
              tone="blue"
            />
            <KpiTile
              label="Tasks"
              value={delivery.tasks}
              hint={`${Math.round(delivery.completionRate)}% complete`}
              icon={ListTodo}
              tone="slate"
              progress={delivery.completionRate}
            />
            <KpiTile
              label="Open"
              value={delivery.open}
              hint={`${delivery.dueToday} due today`}
              icon={CheckCircle2}
              tone="emerald"
            />
            <KpiTile
              label="Critical"
              value={critical}
              hint={`${delivery.overdue} overdue · ${delivery.urgent} urgent`}
              icon={AlertCircle}
              tone={critical > 0 ? 'rose' : 'slate'}
            />
          </div>
        </div>

        {showTargets && targets && (
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Targets KPIs
              </p>
              <p className="text-xs text-slate-500">
                {targets.open} open · {Math.round(targets.completionRate)}% complete
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <KpiTile
                label="Targets"
                value={targets.total}
                hint={`${targets.open} still open`}
                icon={Crosshair}
                tone="violet"
                progress={targets.completionRate}
              />
              <KpiTile
                label="Due this month"
                value={targets.dueThisMonth}
                hint="Open targets ending this month"
                icon={CalendarRange}
                tone="amber"
              />
              <KpiTile
                label="Overdue targets"
                value={targets.overdue}
                hint="Past end date and still open"
                icon={AlertCircle}
                tone={targets.overdue > 0 ? 'rose' : 'slate'}
              />
              <KpiTile
                label="Completed"
                value={targets.completed}
                hint="Finished goals in workspace"
                icon={CheckCircle2}
                tone="emerald"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
