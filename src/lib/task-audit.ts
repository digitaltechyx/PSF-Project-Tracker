import type { Pipeline, Subtask, Task, TaskAudit } from '@/lib/types';
import { getPipelineInfo } from '@/lib/pipelines';

const AUDIT_FIELDS: (keyof Task)[] = [
  'title',
  'description',
  'status',
  'priority',
  'dueDate',
  'assigneeUserIds',
  'tags',
];

const SUBTASK_AUDIT_FIELDS: (keyof Subtask)[] = [
  'title',
  'status',
  'priority',
  'dueDate',
  'assigneeUserIds',
];

/** Major fields that require a change reason in the audit trail. */
export const MAJOR_CHANGE_FIELDS: (keyof Task)[] = [
  'status',
  'priority',
  'dueDate',
  'assigneeUserIds',
];

export function isMajorChangeField(field: string): boolean {
  return MAJOR_CHANGE_FIELDS.includes(field as keyof Task);
}

export type AuditNameMap = Record<string, string>;

export type AuditFormatContext = {
  memberNames?: AuditNameMap;
  pipelines?: Pipeline[];
};

const UID_LIKE = /^[A-Za-z0-9_-]{20,}$/;

function memberLabel(id: string, names?: AuditNameMap): string {
  if (!id) return 'Unknown';
  if (names?.[id]) return names[id];
  if (UID_LIKE.test(id)) return 'Unknown member';
  return id;
}

function formatDateValue(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function normalizeAuditField(field?: string): string {
  if (!field) return '';
  return field.startsWith('subtask.') ? field.slice('subtask.'.length) : field;
}

/** Turn raw stored audit values into human-readable labels. */
export function formatAuditDisplayValue(
  field: string | undefined,
  value: string | null | undefined,
  ctx: AuditFormatContext = {}
): string {
  if (value === undefined || value === null || value === '') return 'Empty';
  const key = normalizeAuditField(field);

  if (key === 'assigneeUserIds') {
    const ids = value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!ids.length) return 'Unassigned';
    return ids.map((id) => memberLabel(id, ctx.memberNames)).join(', ');
  }

  if (key === 'status') {
    const info = getPipelineInfo(ctx.pipelines || [], value);
    return info.name;
  }

  if (key === 'priority') {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  if (key === 'dueDate') {
    return formatDateValue(value) || 'Empty';
  }

  if (key === 'created' || key === 'deleted') {
    return value;
  }

  if (field === 'description') {
    const trimmed = value.trim();
    if (!trimmed) return 'Empty';
    return trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed;
  }

  if (field === 'tags') {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .join(', ') || 'None';
  }

  // Legacy rows may store raw UIDs without field context — try resolve.
  if (value.includes(',') || UID_LIKE.test(value)) {
    const parts = value.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length && parts.every((p) => UID_LIKE.test(p) || ctx.memberNames?.[p])) {
      return parts.map((id) => memberLabel(id, ctx.memberNames)).join(', ');
    }
  }

  return value;
}

function stringifyAuditValue(
  field: keyof Task,
  value: unknown,
  ctx: AuditFormatContext
): string | null {
  if (value === undefined || value === null || value === '') return null;

  if (field === 'assigneeUserIds') {
    const ids = Array.isArray(value) ? value.map(String).filter(Boolean) : [];
    if (!ids.length) return null;
    // Persist readable names so old clients still make sense; keep lookup-friendly via display formatter too.
    return ids.map((id) => memberLabel(id, ctx.memberNames)).join(', ');
  }

  if (field === 'tags') {
    const tags = Array.isArray(value) ? value.map(String).filter(Boolean) : [];
    return tags.length ? tags.join(', ') : null;
  }

  if (field === 'status') {
    return getPipelineInfo(ctx.pipelines || [], String(value)).name;
  }

  if (field === 'priority') {
    const v = String(value);
    return v.charAt(0).toUpperCase() + v.slice(1);
  }

  if (field === 'dueDate') {
    return formatDateValue(value);
  }

  if (field === 'description') {
    const text = String(value).trim();
    if (!text) return null;
    return text.length > 160 ? `${text.slice(0, 157)}…` : text;
  }

  return String(value);
}

function valuesEqual(a: string | null, b: string | null): boolean {
  return (a || null) === (b || null);
}

export function buildFieldChangeAudits(
  before: Task,
  payload: Partial<Task>,
  meta: {
    actorUserId: string;
    actorName: string;
    reason?: string | null;
  },
  ctx: AuditFormatContext = {}
): Omit<TaskAudit, 'id' | 'createdAt'>[] {
  const rows: Omit<TaskAudit, 'id' | 'createdAt'>[] = [];
  const reason = meta.reason?.trim() || null;

  for (const field of AUDIT_FIELDS) {
    if (!(field in payload)) continue;
    const fromRaw = before[field];
    const toRaw = payload[field];
    const fromValue = stringifyAuditValue(field, fromRaw, ctx);
    const toValue = stringifyAuditValue(field, toRaw, ctx);
    if (valuesEqual(fromValue, toValue)) continue;

    const label = formatAuditFieldLabel(field);
    const fromLabel = fromValue || (field === 'assigneeUserIds' ? 'Unassigned' : 'Empty');
    const toLabel = toValue || (field === 'assigneeUserIds' ? 'Unassigned' : 'Empty');
    const base = `${meta.actorName} changed ${label.toLowerCase()} from “${fromLabel}” to “${toLabel}”`;

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
      reason: isMajorChangeField(field) ? reason : null,
      message: reason ? `${base}. Reason: ${reason}` : base,
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
    'subtask.title': 'Subtask title',
    'subtask.status': 'Subtask status',
    'subtask.priority': 'Subtask priority',
    'subtask.dueDate': 'Subtask due date',
    'subtask.assigneeUserIds': 'Subtask assignees',
    'subtask.created': 'Subtask',
    'subtask.deleted': 'Subtask',
  };
  return map[field] || field;
}

function stringifySubtaskAuditValue(
  field: keyof Subtask,
  value: unknown,
  ctx: AuditFormatContext
): string | null {
  return stringifyAuditValue(field as keyof Task, value, ctx);
}

/** Build parent-task audit rows for subtask create / update / delete. */
export function buildSubtaskChangeAudits(
  parent: Pick<Task, 'id' | 'workspaceId' | 'projectId'>,
  before: Subtask | null,
  after: Partial<Subtask> | null,
  meta: {
    actorUserId: string;
    actorName: string;
    action: 'created' | 'updated' | 'deleted';
    subtaskTitle?: string;
  },
  ctx: AuditFormatContext = {}
): Omit<TaskAudit, 'id' | 'createdAt'>[] {
  const title =
    (after?.title || before?.title || meta.subtaskTitle || 'Untitled subtask').trim() ||
    'Untitled subtask';
  const subtaskId = after?.id || before?.id || null;
  const base = {
    workspaceId: parent.workspaceId,
    projectId: parent.projectId,
    taskId: parent.id,
    kind: 'subtask_change' as const,
    actorUserId: meta.actorUserId,
    actorName: meta.actorName,
    reason: null,
    subtaskId,
    subtaskTitle: title,
  };

  if (meta.action === 'created') {
    return [
      {
        ...base,
        field: 'subtask.created',
        fromValue: null,
        toValue: title,
        message: `${meta.actorName} added subtask “${title}”`,
      },
    ];
  }

  if (meta.action === 'deleted') {
    return [
      {
        ...base,
        field: 'subtask.deleted',
        fromValue: title,
        toValue: null,
        message: `${meta.actorName} deleted subtask “${title}”`,
      },
    ];
  }

  if (!before || !after) return [];

  const rows: Omit<TaskAudit, 'id' | 'createdAt'>[] = [];
  for (const field of SUBTASK_AUDIT_FIELDS) {
    if (!(field in after)) continue;
    const fromValue = stringifySubtaskAuditValue(field, before[field], ctx);
    const toValue = stringifySubtaskAuditValue(field, after[field], ctx);
    if (valuesEqual(fromValue, toValue)) continue;

    const label = formatAuditFieldLabel(`subtask.${field}`);
    const fromLabel =
      fromValue || (field === 'assigneeUserIds' ? 'Unassigned' : 'Empty');
    const toLabel = toValue || (field === 'assigneeUserIds' ? 'Unassigned' : 'Empty');
    rows.push({
      ...base,
      field: `subtask.${field}`,
      fromValue,
      toValue,
      message: `${meta.actorName} changed ${label.toLowerCase()} on “${title}” from “${fromLabel}” to “${toLabel}”`,
    });
  }
  return rows;
}

export function formatDateKeyLabel(dateKey?: string | null): string {
  if (!dateKey) return 'Unknown date';
  const d = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateKey;
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Group time logs by date (newest first). */
export function groupTimeLogsByDate<T extends { dateKey: string; durationMs: number }>(
  logs: T[]
): Array<{ dateKey: string; label: string; totalMs: number; entries: T[] }> {
  const map = new Map<string, T[]>();
  for (const log of logs) {
    const key = log.dateKey || 'unknown';
    const list = map.get(key) || [];
    list.push(log);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, entries]) => ({
      dateKey,
      label: formatDateKeyLabel(dateKey),
      totalMs: entries.reduce((sum, e) => sum + (e.durationMs || 0), 0),
      entries: [...entries].sort((a, b) =>
        String((b as any).createdAt || '').localeCompare(String((a as any).createdAt || ''))
      ),
    }));
}
