import type { Action, Actor, AssignmentState } from './types.js';

/** Timestamp columns an action sets to the commit time. */
export type Stamp = 'invited_at' | 'responded_at' | 'cancelled_at' | 'checked_in_at' | 'checked_out_at';

type Rule = {
  actor: Actor;
  /** May the action run from this state? */
  allowedFrom: (state: AssignmentState) => boolean;
  /** Is the assignment already where this action leads? Then a repeat changes nothing. */
  isTarget: (state: AssignmentState) => boolean;
  /** The state after the action. */
  next: (state: AssignmentState) => AssignmentState;
  stamps: readonly Stamp[];
};

/**
 * The transition table: the single source of truth for what each action may do.
 * Rules from the brief, plus assumptions A1 to A7 (see spec.md).
 */
export const TRANSITIONS: Record<Action, Rule> = {
  invite: {
    actor: 'manager',
    allowedFrom: (s) => s.participation === 'uninvited',
    isTarget: (s) => s.participation === 'invited',
    next: (s) => ({ ...s, participation: 'invited' }),
    stamps: ['invited_at'],
  },
  accept: {
    actor: 'worker',
    // A Cancelled worker may accept again (brief). A Declined worker may not (A2).
    allowedFrom: (s) => s.participation === 'invited' || s.participation === 'cancelled',
    isTarget: (s) => s.participation === 'accepted',
    next: (s) => ({ ...s, participation: 'accepted' }),
    stamps: ['responded_at'],
  },
  decline: {
    actor: 'worker',
    allowedFrom: (s) => s.participation === 'invited',
    isTarget: (s) => s.participation === 'declined',
    next: (s) => ({ ...s, participation: 'declined' }),
    stamps: ['responded_at'],
  },
  cancel: {
    actor: 'worker',
    allowedFrom: (s) => s.participation === 'accepted' && s.attendance === 'not_started',
    isTarget: (s) => s.participation === 'cancelled',
    next: (s) => ({ ...s, participation: 'cancelled' }),
    stamps: ['responded_at', 'cancelled_at'],
  },
  check_in: {
    actor: 'worker',
    allowedFrom: (s) => s.participation === 'accepted' && s.attendance === 'not_started',
    // Only "still checked in" is a repeat. After check-out, a check-in is refused, not ignored.
    isTarget: (s) => s.attendance === 'checked_in',
    next: (s) => ({ ...s, attendance: 'checked_in' }),
    stamps: ['checked_in_at'],
  },
  check_out: {
    actor: 'worker',
    allowedFrom: (s) => s.attendance === 'checked_in',
    isTarget: (s) => s.attendance === 'checked_out',
    next: (s) => ({ ...s, attendance: 'checked_out' }),
    stamps: ['checked_out_at'],
  },
};

export type Decision =
  | { kind: 'apply'; next: AssignmentState; stamps: readonly Stamp[] }
  | { kind: 'already'; }
  | { kind: 'refused'; reason: string };

/** Decides what an action does from a given state. Pure: no clock, no database. */
export function applyAction(state: AssignmentState, action: Action): Decision {
  const rule = TRANSITIONS[action];
  if (rule.isTarget(state)) return { kind: 'already' };
  if (rule.allowedFrom(state)) return { kind: 'apply', next: rule.next(state), stamps: rule.stamps };
  return { kind: 'refused', reason: refusalReason(state, action) };
}

/** Actions a user may trigger now (used to show only allowed buttons). */
export function allowedActions(state: AssignmentState): Action[] {
  return (Object.keys(TRANSITIONS) as Action[]).filter((action) =>
    TRANSITIONS[action].allowedFrom(state),
  );
}

export function actorFor(action: Action): Actor {
  return TRANSITIONS[action].actor;
}

/** A human sentence explaining why an action is refused in this state. */
export function refusalReason(state: AssignmentState, action: Action): string {
  const { participation, attendance } = state;
  const notInvited = participation === 'uninvited';

  switch (action) {
    case 'invite':
      if (participation === 'declined') return 'Cannot invite: this worker declined this shift.';
      return 'Cannot invite: this worker has already responded to an invitation.';
    case 'accept':
      if (notInvited) return 'Cannot accept: this worker has not been invited yet.';
      if (participation === 'declined') return 'Cannot accept: this worker declined the invitation.';
      break;
    case 'decline':
      if (notInvited) return 'Cannot decline: this worker has not been invited yet.';
      if (participation === 'accepted') return 'Cannot decline: this worker already accepted. Cancel instead.';
      if (participation === 'cancelled') return 'Cannot decline: this spot is already cancelled.';
      break;
    case 'cancel':
      if (attendance === 'checked_in') return 'Cannot cancel: this worker has already checked in.';
      if (attendance === 'checked_out') return 'Cannot cancel: this worker has already checked out.';
      if (participation === 'declined') return 'Cannot cancel: this worker declined the invitation.';
      return 'Cannot cancel: this worker has not accepted the shift.';
    case 'check_in':
      if (attendance === 'checked_out') return 'Cannot check in: this worker has already checked out.';
      if (participation === 'cancelled') return 'Cannot check in: this spot was cancelled.';
      if (participation === 'declined') return 'Cannot check in: this worker declined the invitation.';
      return 'Cannot check in: only an accepted worker can check in.';
    case 'check_out':
      return 'Cannot check out: this worker has not checked in.';
  }
  return 'This action is not allowed in the current state.';
}
