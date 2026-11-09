import { actorFor, applyAction, type Action, type ActionResult, type Snapshot } from '@staffing/shared';
import { withTransaction, type Db } from './db/pool.js';
import { DomainError } from './errors.js';
import * as repo from './repository.js';

export type StaffingService = ReturnType<typeof createService>;

export function createService(db: Db, options: { demoMode: boolean }) {
  async function getSnapshot(): Promise<Snapshot> {
    // Repeatable read: version, rows and events in the snapshot are from the same moment.
    return withTransaction(db, async (client) => {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      return repo.readSnapshot(client, options.demoMode);
    });
  }

  /**
   * Applies one action in one transaction:
   * lock shift → decide from the transition table → conditional update → version + 1 → event → commit.
   * A repeat of an applied action returns changed: false and writes nothing.
   */
  async function runAction(assignmentId: number, action: Action): Promise<ActionResult> {
    return withTransaction(db, async (client) => {
      const shiftId = await repo.findAssignmentShift(client, assignmentId);
      if (shiftId === null) throw new DomainError('NOT_FOUND', 'This assignment does not exist.');

      const { requiredWorkers } = await repo.lockShift(client, shiftId);
      // Read the state only after taking the lock, so it cannot change under us.
      const current = await repo.readAssignmentState(client, assignmentId);
      const decision = applyAction(current, action);

      if (decision.kind === 'already') {
        return { changed: false, snapshot: await repo.readSnapshot(client, options.demoMode) };
      }
      if (decision.kind === 'refused') {
        throw new DomainError('INVALID_TRANSITION', decision.reason, { current });
      }

      if (action === 'accept') {
        const filled = await repo.countAccepted(client, shiftId);
        if (filled >= requiredWorkers) {
          throw new DomainError('SHIFT_FULL', 'Cannot accept: all places for this shift are filled.', {
            current,
            filled,
            required: requiredWorkers,
          });
        }
      }

      const updated = await repo.updateAssignment(client, assignmentId, current, decision.next, decision.stamps);
      if (!updated) throw new Error(`Assignment ${assignmentId} changed while locked`);

      const version = await repo.bumpVersion(client, shiftId);
      await repo.insertEvent(client, { shiftId, assignmentId, action, actor: actorFor(action), version });
      return { changed: true, snapshot: await repo.readSnapshot(client, options.demoMode) };
    });
  }

  async function checkHealth(): Promise<boolean> {
    try {
      await db.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  return { getSnapshot, runAction, checkHealth };
}
