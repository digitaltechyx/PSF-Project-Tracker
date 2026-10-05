import { AttendanceBreak, AttendanceEntry } from '@/lib/types';

export type AttendanceStatus = 'not_checked_in' | 'working' | 'on_break' | 'done';

export function getAttendanceStatus(entry?: AttendanceEntry | null): AttendanceStatus {
  if (!entry?.checkInTime) return 'not_checked_in';
  if (entry.checkOutTime) return 'done';
  const breaks = entry.breaks || [];
  const openBreak = breaks.find((b) => b.startTime && !b.endTime);
  if (openBreak) return 'on_break';
  return 'working';
}

export function formatAttendanceTime(iso?: string | null, mounted = true) {
  if (!mounted || !iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatAttendanceDate(dateKey?: string, mounted = true) {
  if (!mounted || !dateKey) return '';
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function breakDurationMs(b: AttendanceBreak, now: number) {
  if (!b.startTime) return 0;
  const start = new Date(b.startTime).getTime();
  const end = b.endTime ? new Date(b.endTime).getTime() : now;
  return Math.max(0, end - start);
}

/** Total elapsed from check-in to check-out (or now). */
export function getAttendanceElapsedMs(entry?: AttendanceEntry | null, now = Date.now()) {
  if (!entry?.checkInTime) return 0;
  const start = new Date(entry.checkInTime).getTime();
  const end = entry.checkOutTime ? new Date(entry.checkOutTime).getTime() : now;
  return Math.max(0, end - start);
}

export function getBreakMs(entry?: AttendanceEntry | null, now = Date.now()) {
  if (!entry?.breaks?.length) return entry?.totalBreakMs || 0;
  const fromSegments = entry.breaks.reduce((sum, b) => sum + breakDurationMs(b, now), 0);
  return Math.max(fromSegments, entry.totalBreakMs || 0);
}

/** Billable / working time = elapsed minus breaks. */
export function getWorkMs(entry?: AttendanceEntry | null, now = Date.now()) {
  const elapsed = getAttendanceElapsedMs(entry, now);
  const breaks = getBreakMs(entry, now);
  return Math.max(0, elapsed - breaks);
}

/** @deprecated use getWorkMs */
export function getAttendanceDurationMs(entry?: AttendanceEntry | null, now = Date.now()) {
  return getWorkMs(entry, now);
}

export function formatDuration(ms: number) {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

export function formatDurationClock(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((n) => n.toString().padStart(2, '0')).join(':');
}

export function statusLabel(status: AttendanceStatus) {
  switch (status) {
    case 'not_checked_in':
      return 'Away';
    case 'working':
      return 'Working';
    case 'on_break':
      return 'On break';
    case 'done':
      return 'Done';
  }
}
