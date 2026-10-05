import { Pipeline } from '@/lib/types';

export const DEFAULT_PIPELINES: Pipeline[] = [
  { id: 'todo', name: 'To Do', color: '#94a3b8', category: 'open' },
  { id: 'in_progress', name: 'In Progress', color: '#3b82f6', category: 'open' },
  { id: 'on_hold', name: 'On Hold', color: '#f59e0b', category: 'open' },
  { id: 'done', name: 'Done', color: '#22c55e', category: 'closed' },
];

export const STATUS_COLOR_PRESETS = [
  '#94a3b8',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#ef4444',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#6366f1',
];

export function getProjectPipelines(project?: { pipelines?: Pipeline[] | null } | null): Pipeline[] {
  if (project?.pipelines && project.pipelines.length > 0) {
    return project.pipelines;
  }
  return DEFAULT_PIPELINES;
}

export function getPipelineInfo(pipelines: Pipeline[], statusId: string): Pipeline {
  return (
    pipelines.find((p) => p.id === statusId) || {
      id: statusId,
      name: statusId.replace(/_/g, ' '),
      color: '#94a3b8',
      category: 'open',
    }
  );
}

export function getClosedStatusId(pipelines: Pipeline[]): string {
  const closed = pipelines.find((p) => p.category === 'closed');
  if (closed) return closed.id;
  return pipelines[pipelines.length - 1]?.id || 'done';
}

export function getOpenStatusId(pipelines: Pipeline[]): string {
  const open = pipelines.find((p) => p.category !== 'closed');
  return open?.id || pipelines[0]?.id || 'todo';
}

export function isClosedStatus(pipelines: Pipeline[], statusId: string): boolean {
  const p = pipelines.find((x) => x.id === statusId);
  if (p?.category === 'closed') return true;
  return statusId === getClosedStatusId(pipelines);
}

export function slugifyStatusId(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
  return base || `status_${Date.now().toString(36)}`;
}

export function createUniqueStatusId(name: string, existing: Pipeline[]): string {
  let id = slugifyStatusId(name);
  const ids = new Set(existing.map((p) => p.id));
  if (!ids.has(id)) return id;
  let n = 2;
  while (ids.has(`${id}_${n}`)) n += 1;
  return `${id}_${n}`;
}
