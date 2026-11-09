import type { Assignment } from '@staffing/shared';

export const BURST_SIZE = 10;
export const OUTAGE_SECONDS = 5;

export type DemoOutcome =
  | { ok: true }
  | { ok: false; kind: 'refused'; message: string }
  | { ok: false; kind: 'unreachable' };

/**
 * The worker the burst is aimed at: the first one who accepted and has not checked in yet, else
 * one who is checked in (the burst then shows that repeats change nothing), else nobody. A worker
 * who already checked out is skipped because the server refuses a check-in for them.
 */
export function pickDemoTarget(assignments: Assignment[]): Assignment | null {
  const candidates = assignments.filter(
    (a) => a.participation === 'accepted' && a.attendance !== 'checked_out',
  );
  return candidates.find((a) => a.attendance === 'not_started') ?? candidates[0] ?? null;
}

/** The server's own message from an error body, read leniently (the demo routes may be terse). */
function errorMessageOf(body: unknown): string {
  const message = (body as { error?: { message?: unknown } } | null)?.error?.message;
  return typeof message === 'string' ? message : 'The server refused the demo request.';
}

/** One demo request. No retries: a demo control should do exactly what the button says, once. */
async function postDemo(path: string): Promise<DemoOutcome> {
  let response: Response;
  try {
    response = await fetch(path, { method: 'POST', cache: 'no-store' });
  } catch {
    return { ok: false, kind: 'unreachable' };
  }
  if (response.ok) return { ok: true };
  const body: unknown = await response.json().catch(() => null);
  return { ok: false, kind: 'refused', message: errorMessageOf(body) };
}

export const sendCheckInBurst = (assignmentId: number) =>
  postDemo(`/api/demo/burst?assignmentId=${assignmentId}&action=check-in`);

export const simulateOutage = (seconds = OUTAGE_SECONDS) =>
  postDemo(`/api/demo/outage?seconds=${seconds}`);
