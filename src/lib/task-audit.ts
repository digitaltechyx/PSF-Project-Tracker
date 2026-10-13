import type { Task, TaskAudit } from '@/lib/types';

const AUDIT_FIELDS: (keyof Task)[] = [
  'title',
  'description',
  'status',
  'priority',
  'dueDate',
  'assigneeUserIds',
  'tags',
];

function stringifyValue(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (Array.isArray(value)) return value.length ? value.join(', ') : null;
  return String(value);
}

export function buildFieldChangeAudits(
  before: Task,
  payload: Partial<Task>,
  meta: {
    actorUserId: string;
    actorName: string;
  }
): Omit<TaskAudit, 'id' | 'createdAt'>[] {
  const rows: Omit<TaskAudit, 'id' | 'createdAt'>[] = [];
  for (const field of AUDIT_FIELDS) {
    if (!(field in payload)) continue;
    const fromRaw = before[field];
    const toRaw = payload[field];
    const fromValue = stringifyValue(fromRaw);
    const toValue = stringifyValue(toRaw);
    if (fromValue === toValue) continue;
    rows.push({
      workspaceId: before.workspaceId,
      projectId: before.projectId,
      taskId: before.id,
      kind: 'field_change',
      actorUserId: meta.actorUserId,
      actorName: meta.actorName,
      field,
      fromValue,
      toValue,
      message: `${meta.actorName} changed ${field}`,
    });
  }
  return rows;
}

export function formatDurationMinutes(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  if (m <= 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatAuditFieldLabel(field?: string): string {
  if (!field) return 'Field';
  const map: Record<string, string> = {
    title: 'Title',
    description: 'Description',
    status: 'Status',
    priority: 'Priority',
    dueDate: 'Due date',
    assigneeUserIds: 'Assignees',
    tags: 'Tags',
  };
  return map[field] || field;
}
