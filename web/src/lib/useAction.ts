import { useCallback, useState } from 'react';
import type { Action, Snapshot } from '@staffing/shared';
import { useToast } from '../components/Toasts.js';
import { postAction } from './api.js';
import { firstName, formatTime } from './format.js';
import { applySnapshot } from './live.js';

/** Toast wording from the State Sheet (docs/design/State Sheet.dc.html, section 4). */
function successTitle(action: Action, snapshot: Snapshot, assignmentId: number): string {
  const a = snapshot.assignments.find((x) => x.id === assignmentId);
  const name = a ? firstName(a.worker.fullName) : 'The worker';
  switch (action) {
    case 'invite':
      return `Invite sent to ${name}`;
    case 'accept':
      return `You're on the shift. See you at ${formatTime(snapshot.shift.startsAt)}`;
    case 'decline':
      return 'Declined. Thanks for letting us know';
    case 'cancel':
      return 'Your spot was released';
    case 'check_in':
      return `Checked in at ${formatTime(a?.checkedInAt ?? null)}`;
    case 'check_out':
      return `Checked out at ${formatTime(a?.checkedOutAt ?? null)}`;
  }
}

function alreadyTitle(action: Action, snapshot: Snapshot, assignmentId: number): string {
  const a = snapshot.assignments.find((x) => x.id === assignmentId);
  const name = a ? firstName(a.worker.fullName) : 'The worker';
  switch (action) {
    case 'invite':
      return `${name} is already invited`;
    case 'accept':
      return 'Already accepted';
    case 'decline':
      return 'Already declined';
    case 'cancel':
      return 'Spot already released';
    case 'check_in':
      return `Already checked in at ${formatTime(a?.checkedInAt ?? null)}`;
    case 'check_out':
      return `Already checked out at ${formatTime(a?.checkedOutAt ?? null)}`;
  }
}

/**
 * Runs an action with honest feedback: the control is disabled while pending, a repeat is a
 * neutral notice (not an error), a refusal explains why, and a network failure says nothing was
 * saved.
 */
export function useAction() {
  const toast = useToast();
  const [pending, setPending] = useState<string | null>(null);

  const run = useCallback(
    async (assignmentId: number, action: Action) => {
      setPending(`${assignmentId}:${action}`);
      try {
        const outcome = await postAction(assignmentId, action);
        if (outcome.ok) {
          const { changed, snapshot } = outcome.result;
          applySnapshot(snapshot);
          if (changed) toast('success', successTitle(action, snapshot, assignmentId));
          else toast('neutral', alreadyTitle(action, snapshot, assignmentId), 'Not an error. Nothing changed.');
        } else if (outcome.kind === 'refused') {
          toast('conflict', outcome.error.message);
        } else {
          toast('network', "Couldn't reach the server. Nothing was saved. Try again.");
        }
        return outcome;
      } finally {
        setPending(null);
      }
    },
    [toast],
  );

  const isPending = (assignmentId: number, action?: Action) =>
    pending !== null &&
    (action ? pending === `${assignmentId}:${action}` : pending.startsWith(`${assignmentId}:`));

  return { run, isPending, busy: pending !== null };
}
