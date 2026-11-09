import type { AssignmentState, Counts } from './types.js';

/**
 * Counts are always derived from the assignments, never stored, so they cannot disagree with the
 * worker list. Filled includes workers who are checked in or checked out (participation stays
 * Accepted during attendance).
 */
export function deriveCounts(assignments: readonly AssignmentState[], requiredWorkers: number): Counts {
  const counts: Counts = {
    filled: 0,
    remaining: 0,
    checkedIn: 0,
    checkedOut: 0,
    invited: 0,
    declined: 0,
    cancelled: 0,
    uninvited: 0,
  };

  for (const { participation, attendance } of assignments) {
    if (participation === 'accepted') counts.filled += 1;
    if (participation === 'invited') counts.invited += 1;
    if (participation === 'declined') counts.declined += 1;
    if (participation === 'cancelled') counts.cancelled += 1;
    if (participation === 'uninvited') counts.uninvited += 1;
    if (attendance === 'checked_in') counts.checkedIn += 1;
    if (attendance === 'checked_out') counts.checkedOut += 1;
  }

  counts.remaining = requiredWorkers - counts.filled;
  return counts;
}
