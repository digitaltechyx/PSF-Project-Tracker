/** Default company timezone for workspaces that have not set one yet. */
export const DEFAULT_WORKSPACE_TIMEZONE = 'Asia/Karachi';

export const WORKSPACE_TIMEZONES: Array<{ value: string; label: string }> = [
  { value: 'Asia/Karachi', label: 'Pakistan (Asia/Karachi)' },
  { value: 'Asia/Dubai', label: 'UAE (Asia/Dubai)' },
  { value: 'Asia/Kolkata', label: 'India (Asia/Kolkata)' },
  { value: 'Asia/Dhaka', label: 'Bangladesh (Asia/Dhaka)' },
  { value: 'Asia/Riyadh', label: 'Saudi Arabia (Asia/Riyadh)' },
  { value: 'Asia/Singapore', label: 'Singapore (Asia/Singapore)' },
  { value: 'Europe/London', label: 'UK (Europe/London)' },
  { value: 'Europe/Berlin', label: 'Central Europe (Europe/Berlin)' },
  { value: 'America/New_York', label: 'US Eastern (America/New_York)' },
  { value: 'America/Chicago', label: 'US Central (America/Chicago)' },
  { value: 'America/Denver', label: 'US Mountain (America/Denver)' },
  { value: 'America/Los_Angeles', label: 'US Pacific (America/Los_Angeles)' },
  { value: 'UTC', label: 'UTC' },
];

export function resolveWorkspaceTimezone(timeZone?: string | null): string {
  if (timeZone && isValidTimeZone(timeZone)) return timeZone;
  return DEFAULT_WORKSPACE_TIMEZONE;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Attendance / time-log day key in company timezone (YYYY-MM-DD). */
export function getDateKeyInTimeZone(date: Date = new Date(), timeZone?: string | null): string {
  const tz = resolveWorkspaceTimezone(timeZone);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatTimeInTimeZone(
  iso?: string | null,
  timeZone?: string | null,
  mounted = true
): string {
  if (!mounted || !iso) return '—';
  const tz = resolveWorkspaceTimezone(timeZone);
  return new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatDateInTimeZone(
  date: Date = new Date(),
  timeZone?: string | null,
  mounted = true
): string {
  if (!mounted) return '—';
  const tz = resolveWorkspaceTimezone(timeZone);
  return new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function formatClockInTimeZone(
  date: Date = new Date(),
  timeZone?: string | null,
  mounted = true
): string {
  if (!mounted) return '--:--:--';
  const tz = resolveWorkspaceTimezone(timeZone);
  return new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date);
}

export function getTimezoneShortLabel(timeZone?: string | null): string {
  const tz = resolveWorkspaceTimezone(timeZone);
  const known = WORKSPACE_TIMEZONES.find((z) => z.value === tz);
  if (known) {
    const paren = known.label.match(/\(([^)]+)\)/);
    return paren?.[1] || known.label;
  }
  return tz;
}

export function getTimezoneOffsetLabel(timeZone?: string | null, date: Date = new Date()): string {
  const tz = resolveWorkspaceTimezone(timeZone);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(date);
    return parts.find((p) => p.type === 'timeZoneName')?.value || tz;
  } catch {
    return tz;
  }
}
