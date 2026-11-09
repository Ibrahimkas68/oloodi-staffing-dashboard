import { describe, expect, it } from 'vitest';
import { ACTIONS, ATTENDANCES, PARTICIPATIONS } from '../src/schemas.js';
import { allowedActions, applyAction } from '../src/transitions.js';
import type { Action, AssignmentState } from '../src/types.js';

/**
 * The expected behaviour, written independently of the implementation.
 * Key: `${participation}/${attendance}/${action}` → expected decision kind and next state.
 */
const ALLOWED: Record<string, AssignmentState> = {
  'uninvited/not_started/invite': { participation: 'invited', attendance: 'not_started' },
  'invited/not_started/accept': { participation: 'accepted', attendance: 'not_started' },
  'cancelled/not_started/accept': { participation: 'accepted', attendance: 'not_started' },
  'invited/not_started/decline': { participation: 'declined', attendance: 'not_started' },
  'accepted/not_started/cancel': { participation: 'cancelled', attendance: 'not_started' },
  'accepted/not_started/check_in': { participation: 'accepted', attendance: 'checked_in' },
  'accepted/checked_in/check_out': { participation: 'accepted', attendance: 'checked_out' },
};

const ALREADY = new Set([
  'invited/not_started/invite',
  'accepted/not_started/accept',
  'accepted/checked_in/accept',
  'accepted/checked_out/accept',
  'declined/not_started/decline',
  'cancelled/not_started/cancel',
  'accepted/checked_in/check_in',
  'accepted/checked_out/check_out',
]);

// Only states the database allows: attendance other than not_started requires accepted.
const STATES: AssignmentState[] = PARTICIPATIONS.flatMap((participation) =>
  ATTENDANCES.filter((attendance) => attendance === 'not_started' || participation === 'accepted').map(
    (attendance) => ({ participation, attendance }),
  ),
);

const CASES = STATES.flatMap((state) => ACTIONS.map((action) => ({ state, action })));

describe('transition table', () => {
  it('covers every reachable state and action', () => {
    expect(STATES).toHaveLength(7);
    expect(CASES).toHaveLength(42);
  });

  it.each(CASES)('$state.participation/$state.attendance + $action', ({ state, action }) => {
    const key = `${state.participation}/${state.attendance}/${action}`;
    const decision = applyAction(state, action as Action);

    if (key in ALLOWED) {
      expect(decision).toMatchObject({ kind: 'apply', next: ALLOWED[key] });
    } else if (ALREADY.has(key)) {
      expect(decision).toEqual({ kind: 'already' });
    } else {
      expect(decision.kind).toBe('refused');
      if (decision.kind === 'refused') expect(decision.reason).toMatch(/^Cannot /);
    }
  });

  it('refuses check-in after check-out instead of treating it as a repeat', () => {
    const decision = applyAction({ participation: 'accepted', attendance: 'checked_out' }, 'check_in');
    expect(decision).toMatchObject({
      kind: 'refused',
      reason: 'Cannot check in: this worker has already checked out.',
    });
  });

  it('never re-invites a declined worker (A1)', () => {
    expect(applyAction({ participation: 'declined', attendance: 'not_started' }, 'invite').kind).toBe(
      'refused',
    );
  });

  it('stamps the right times', () => {
    const cancel = applyAction({ participation: 'accepted', attendance: 'not_started' }, 'cancel');
    expect(cancel).toMatchObject({ stamps: ['responded_at', 'cancelled_at'] });
  });

  it('lists only allowed actions for buttons', () => {
    expect(allowedActions({ participation: 'invited', attendance: 'not_started' })).toEqual([
      'accept',
      'decline',
    ]);
    expect(allowedActions({ participation: 'accepted', attendance: 'not_started' })).toEqual([
      'cancel',
      'check_in',
    ]);
    expect(allowedActions({ participation: 'accepted', attendance: 'checked_out' })).toEqual([]);
    expect(allowedActions({ participation: 'declined', attendance: 'not_started' })).toEqual([]);
  });
});
