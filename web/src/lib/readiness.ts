import type { Assignment, Snapshot } from '@staffing/shared';
import { firstName } from './format.js';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** "45 min", "3h", "2h 15min", "2 days". Rounds down; anything under a minute is "1 min". */
export function formatDuration(ms: number): string {
  const minutes = Math.max(1, Math.floor(ms / MINUTE_MS));
  if (ms >= DAY_MS) {
    const days = Math.floor(ms / DAY_MS);
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  }
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}min`;
}

/** "Salma", "Salma and Youssef", "Salma, Youssef and Amina". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function timingPhrase(shift: Snapshot['shift'], now: number): string {
  const starts = Date.parse(shift.startsAt);
  const ends = Date.parse(shift.endsAt);
  if (now < starts) return `starts in ${formatDuration(starts - now)}`;
  if (now < ends) return `started ${formatDuration(now - starts)} ago`;
  return 'has ended';
}

const isAccepted = (a: Assignment) => a.participation === 'accepted';

/**
 * One plain sentence about how ready the shift is, for example
 * "2 of 3 places filled · starts in 3h · Salma accepted, not checked in yet".
 * "Shift complete" once there are accepted workers and every one of them has checked out.
 */
export function readinessSentence(snapshot: Snapshot, now: number): string {
  const accepted = snapshot.assignments.filter(isAccepted);
  if (accepted.length > 0 && accepted.every((a) => a.attendance === 'checked_out'))
    return 'Shift complete';

  const { filled } = snapshot.counts;
  const parts = [
    `${filled} of ${snapshot.shift.requiredWorkers} places filled`,
    timingPhrase(snapshot.shift, now),
  ];
  const waiting = accepted.filter((a) => a.attendance === 'not_started');
  if (waiting.length > 0) {
    parts.push(
      `${joinNames(waiting.map((a) => firstName(a.worker.fullName)))} accepted, not checked in yet`,
    );
  }
  return parts.join(' · ');
}
