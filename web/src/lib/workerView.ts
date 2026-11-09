import { actorFor, allowedActions, type Action, type AssignmentState } from '@staffing/shared';
import type { ButtonVariant } from '../components/Button.js';
import { formatTime } from './format.js';

/** What the worker may press, first to last. Primary actions come first, "Cancel my spot" last. */
export const WORKER_ACTIONS = ['accept', 'decline', 'check_in', 'check_out', 'cancel'] as const;

/** The actions a worker can take. "invite" belongs to the manager and is not in this list. */
export type WorkerAction = (typeof WORKER_ACTIONS)[number];

export const ACTION_UI: Record<WorkerAction, { label: string; busyLabel: string; variant: ButtonVariant }> = {
  accept: { label: 'Accept', busyLabel: 'Accepting…', variant: 'primary' },
  decline: { label: 'Decline', busyLabel: 'Declining…', variant: 'secondary' },
  cancel: { label: 'Cancel my spot', busyLabel: 'Cancelling…', variant: 'text' },
  check_in: { label: 'Check in', busyLabel: 'Checking in…', variant: 'primary' },
  check_out: { label: 'Check out', busyLabel: 'Checking out…', variant: 'primary' },
};

/** Button text for an action; accepting after a cancellation reads "Accept again". */
export function actionLabel(action: WorkerAction, state: AssignmentState): string {
  return action === 'accept' && state.participation === 'cancelled' ? 'Accept again' : ACTION_UI[action].label;
}

/**
 * Text shown next to (or instead of) the buttons:
 * info = grey panel, hint = a line above the buttons, final = nothing more to do
 * (`icon: 'check'` marks a happy ending, like finishing the shift).
 */
export type WorkerMessage = { tone: 'info' | 'hint' | 'final'; title?: string; text: string; icon?: 'check' };

export type WorkerView = { actions: WorkerAction[]; message?: WorkerMessage };

/** The part of an assignment the view depends on. */
type ViewState = AssignmentState & { checkedOutAt?: string | null };

function messageFor(state: ViewState): WorkerMessage | undefined {
  if (state.participation === 'uninvited') {
    return {
      tone: 'info',
      title: 'No invitation yet',
      text: 'When the manager invites you to this shift, you can accept it here.',
    };
  }
  if (state.participation === 'cancelled') {
    return { tone: 'hint', text: 'You released your spot. If you can make it after all, accept again.' };
  }
  if (state.participation === 'declined') {
    return { tone: 'final', text: 'You declined this shift. Thanks for letting us know.' };
  }
  if (state.attendance === 'checked_out') {
    const when = state.checkedOutAt ? ` at ${formatTime(state.checkedOutAt)}` : '';
    return { tone: 'final', icon: 'check', text: `You checked out${when}. Thanks!` };
  }
  return undefined;
}

/**
 * What the worker sees for a state: the worker actions the transition table allows (the filter
 * matters, because an uninvited worker's only allowed action is the manager's "invite") and the
 * message that goes with it. Pure, so every state can be tested without rendering.
 */
export function workerView(state: ViewState): WorkerView {
  const allowed = new Set<Action>(allowedActions(state).filter((action) => actorFor(action) === 'worker'));
  return {
    actions: WORKER_ACTIONS.filter((action) => allowed.has(action)),
    message: messageFor(state),
  };
}
