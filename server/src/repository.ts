import {
  deriveCounts,
  type Action,
  type Actor,
  type AssignmentState,
  type Snapshot,
  type Stamp,
} from '@staffing/shared';
import type pg from 'pg';

// Every query below uses $n placeholders. No SQL is ever built from request input.

type Queryable = Pick<pg.PoolClient, 'query'>;

type ShiftRow = {
  id: number;
  title: string;
  location: string;
  starts_at: Date;
  ends_at: Date;
  required_workers: number;
  version: number;
};

type AssignmentRow = {
  id: number;
  worker_id: number;
  full_name: string;
  participation: AssignmentState['participation'];
  attendance: AssignmentState['attendance'];
  invited_at: Date | null;
  responded_at: Date | null;
  cancelled_at: Date | null;
  checked_in_at: Date | null;
  checked_out_at: Date | null;
};

type EventRow = {
  id: number;
  action: Action;
  actor: Actor;
  assignment_id: number;
  full_name: string;
  at: Date;
  version: number;
};

const iso = (date: Date | null) => (date ? date.toISOString() : null);

/** Maps database rows to the Snapshot contract (camelCase, ISO times, derived counts). */
export function toSnapshot(
  shift: ShiftRow,
  assignments: AssignmentRow[],
  events: EventRow[],
  demoMode: boolean,
): Snapshot {
  return {
    version: shift.version,
    serverTime: new Date().toISOString(),
    demoMode,
    shift: {
      id: shift.id,
      title: shift.title,
      location: shift.location,
      startsAt: shift.starts_at.toISOString(),
      endsAt: shift.ends_at.toISOString(),
      requiredWorkers: shift.required_workers,
    },
    assignments: assignments.map((row) => ({
      id: row.id,
      worker: { id: row.worker_id, fullName: row.full_name },
      participation: row.participation,
      attendance: row.attendance,
      invitedAt: iso(row.invited_at),
      respondedAt: iso(row.responded_at),
      cancelledAt: iso(row.cancelled_at),
      checkedInAt: iso(row.checked_in_at),
      checkedOutAt: iso(row.checked_out_at),
    })),
    counts: deriveCounts(assignments, shift.required_workers),
    recentEvents: events.map((row) => ({
      id: row.id,
      action: row.action,
      actor: row.actor,
      assignmentId: row.assignment_id,
      workerName: row.full_name,
      at: row.at.toISOString(),
      version: row.version,
    })),
  };
}

/**
 * Reads the whole snapshot with the given client. Called inside a transaction so the version,
 * rows and events all belong to the same moment.
 */
export async function readSnapshot(db: Queryable, demoMode: boolean): Promise<Snapshot> {
  const shiftResult = await db.query<ShiftRow>(
    `SELECT id, title, location, starts_at, ends_at, required_workers, version::int AS version
       FROM shifts ORDER BY id LIMIT 1`,
  );
  const shift = shiftResult.rows[0];
  if (!shift) throw new Error('No shift found. Run npm run db:reset.');

  const assignments = await db.query<AssignmentRow>(
    `SELECT a.id, a.worker_id, w.full_name, a.participation, a.attendance,
            a.invited_at, a.responded_at, a.cancelled_at, a.checked_in_at, a.checked_out_at
       FROM assignments a JOIN workers w ON w.id = a.worker_id
      WHERE a.shift_id = $1
      ORDER BY a.id`,
    [shift.id],
  );
  const events = await db.query<EventRow>(
    `SELECT e.id::int AS id, e.action, e.actor, e.assignment_id, w.full_name, e.at,
            e.version::int AS version
       FROM events e
       JOIN assignments a ON a.id = e.assignment_id
       JOIN workers w ON w.id = a.worker_id
      WHERE e.shift_id = $1
      ORDER BY e.id DESC
      LIMIT 20`,
    [shift.id],
  );
  return toSnapshot(shift, assignments.rows, events.rows, demoMode);
}

export async function findAssignmentShift(db: Queryable, assignmentId: number): Promise<number | null> {
  const { rows } = await db.query<{ shift_id: number }>(
    'SELECT shift_id FROM assignments WHERE id = $1',
    [assignmentId],
  );
  return rows[0]?.shift_id ?? null;
}

/** Locks the shift row: every change to this shift is applied one at a time. */
export async function lockShift(db: Queryable, shiftId: number): Promise<{ requiredWorkers: number }> {
  const { rows } = await db.query<{ required_workers: number }>(
    'SELECT required_workers FROM shifts WHERE id = $1 FOR UPDATE',
    [shiftId],
  );
  if (!rows[0]) throw new Error(`Shift ${shiftId} disappeared`);
  return { requiredWorkers: rows[0].required_workers };
}

export async function readAssignmentState(db: Queryable, assignmentId: number): Promise<AssignmentState> {
  const { rows } = await db.query<AssignmentState>(
    'SELECT participation, attendance FROM assignments WHERE id = $1',
    [assignmentId],
  );
  if (!rows[0]) throw new Error(`Assignment ${assignmentId} disappeared`);
  return rows[0];
}

export async function countAccepted(db: Queryable, shiftId: number): Promise<number> {
  const { rows } = await db.query<{ filled: number }>(
    "SELECT count(*)::int AS filled FROM assignments WHERE shift_id = $1 AND participation = 'accepted'",
    [shiftId],
  );
  return rows[0]?.filled ?? 0;
}

// Fixed column list: stamp names come from the transition table, never from the request.
const STAMP_SQL: Record<Stamp, string> = {
  invited_at: 'invited_at = now()',
  responded_at: 'responded_at = now()',
  cancelled_at: 'cancelled_at = now()',
  checked_in_at: 'checked_in_at = now()',
  checked_out_at: 'checked_out_at = now()',
};

/**
 * Conditional update: only changes the row if it is still in the state we decided from.
 * Returns false if it was not (which the shift lock makes impossible in practice).
 */
export async function updateAssignment(
  db: Queryable,
  assignmentId: number,
  from: AssignmentState,
  to: AssignmentState,
  stamps: readonly Stamp[],
): Promise<boolean> {
  const sets = ['participation = $2', 'attendance = $3', 'updated_at = now()', ...stamps.map((s) => STAMP_SQL[s])];
  const { rowCount } = await db.query(
    `UPDATE assignments SET ${sets.join(', ')}
      WHERE id = $1 AND participation = $4 AND attendance = $5`,
    [assignmentId, to.participation, to.attendance, from.participation, from.attendance],
  );
  return rowCount === 1;
}

export async function bumpVersion(db: Queryable, shiftId: number): Promise<number> {
  const { rows } = await db.query<{ version: number }>(
    'UPDATE shifts SET version = version + 1 WHERE id = $1 RETURNING version::int AS version',
    [shiftId],
  );
  return rows[0]!.version;
}

export async function insertEvent(
  db: Queryable,
  event: { shiftId: number; assignmentId: number; action: Action; actor: Actor; version: number },
): Promise<void> {
  await db.query(
    'INSERT INTO events (shift_id, assignment_id, action, actor, version) VALUES ($1, $2, $3, $4, $5)',
    [event.shiftId, event.assignmentId, event.action, event.actor, event.version],
  );
}
