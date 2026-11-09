// 24-hour times and short dates, as in the design ("14:00", "Sun 8 Nov").
const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const date = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** "14:02", or "—" when there is no (valid) time. Never throws. */
export function formatTime(value: string | number | Date | null): string {
  if (value === null) return '—';
  const moment = new Date(value);
  return Number.isNaN(moment.getTime()) ? '—' : time.format(moment);
}

export function formatDay(iso: string, now = new Date()): string {
  const day = new Date(iso);
  const sameDay = day.toDateString() === now.toDateString();
  return sameDay ? `Today, ${date.format(day)}` : date.format(day);
}

export function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

export function firstName(fullName: string): string {
  return fullName.split(/\s+/)[0] ?? fullName;
}
