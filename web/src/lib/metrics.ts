import type { Snapshot } from '@staffing/shared';

/**
 * Client-side estimate of how long a change took to reach this screen: when the snapshot arrived
 * minus the time of the newest event it carries. Null when the snapshot carries no event for its
 * own version (a reset, or nothing has happened yet). The two clocks are different machines, so a
 * skew can shift the number; a negative result is shown as 0.
 */
export function updateDelayMs(snapshot: Snapshot, receivedAt: number): number | null {
  const latest = snapshot.recentEvents?.[0];
  if (!latest || latest.version !== snapshot.version) return null;
  const eventAt = Date.parse(latest.at);
  return Number.isNaN(eventAt) ? null : Math.max(0, Math.round(receivedAt - eventAt));
}

/** "180 ms" for a delay, "1.4 s" for a recovery time; a dash when nothing was measured yet. */
export function formatMs(ms: number | null): string {
  if (ms === null) return '—';
  return ms < 1_000 ? `${ms} ms` : `${(ms / 1_000).toFixed(1)} s`;
}
