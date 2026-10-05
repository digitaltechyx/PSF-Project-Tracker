import { AttendanceEntry } from '@/lib/types';

export type AttendanceStatus = 'not_checked_in' | 'working' | 'done';

export function getAttendanceStatus(entry?: AttendanceEntry | null): AttendanceStatus {
  if (!entry?.checkInTime) return 'not_checked_in';
  if (entry.checkOutTime) return 'done';
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

/** Duration in ms between check-in and check-out (or now if still working). */
export function getAttendanceDurationMs(entry?: AttendanceEntry | null, now = Date.now()) {
  if (!entry?.checkInTime) return 0;
  const start = new Date(entry.checkInTime).getTime();
  const end = entry.checkOutTime ? new Date(entry.checkOutTime).getTime() : now;
  return Math.max(0, end - start);
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
