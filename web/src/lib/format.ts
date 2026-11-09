const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const date = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

export const formatTime = (iso: string | null) => (iso ? time.format(new Date(iso)) : '—');
export const formatDate = (iso: string) => date.format(new Date(iso));

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
