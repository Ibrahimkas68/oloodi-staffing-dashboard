import { useCallback, useRef, useState } from 'react';
import type { Action, Snapshot } from '@staffing/shared';
import { useToast } from '../components/Toasts.js';
import { postAction } from './api.js';
import { firstName, formatTime } from './format.js';
import { applySnapshot } from './live.js';

/** The worker row an action applies to, and the first name to use in toasts. */
function describeAssignment(snapshot: Snapshot, assignmentId: number) {
  const assignment = snapshot.assignments.find((a) => a.id === assignmentId);
  const name = assignment ? firstName(assignment.worker.fullName) : 'The worker';
  return { assignment, name };
}

/** Toast wording from the State Sheet (docs/design/State Sheet.dc.html, section 4). */
function successTitle(action: Action, snapshot: Snapshot, assignmentId: number): string {
  const { assignment, name } = describeAssignment(snapshot, assignmentId);
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
      return `Checked in at ${formatTime(assignment?.checkedInAt ?? null)}`;
    case 'check_out':
      return `Checked out at ${formatTime(assignment?.checkedOutAt ?? null)}`;
  }
}

function alreadyTitle(action: Action, snapshot: Snapshot, assignmentId: number): string {
  const { assignment, name } = describeAssignment(snapshot, assignmentId);
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
      return `Already checked in at ${formatTime(assignment?.checkedInAt ?? null)}`;
    case 'check_out':
      return `Already checked out at ${formatTime(assignment?.checkedOutAt ?? null)}`;
  }
}

const requestKey = (assignmentId: number, action: Action) => `${assignmentId}:${action}`;

/**
 * Runs an action with honest feedback: the control is disabled while pending, a repeat is a
 * neutral notice (not an error), a refusal explains why, and a network failure says nothing was
 * saved. Each assignment and action pair tracks its own pending state, and a second call for a
 * pair that is still in flight is ignored (it resolves to `undefined`, nothing is sent).
 */
export function useAction() {
  const toast = useToast();
  // The ref is the source of truth (checked and updated synchronously, so two calls in the same
  // tick cannot both send); the state copy only re-renders the buttons.
  const inFlightRef = useRef(new Set<string>());
  const [inFlight, setInFlight] = useState<ReadonlySet<string>>(new Set());

  const run = useCallback(
    async (assignmentId: number, action: Action) => {
      const key = requestKey(assignmentId, action);
      if (inFlightRef.current.has(key)) return undefined;

      inFlightRef.current.add(key);
      setInFlight(new Set(inFlightRef.current));
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
        inFlightRef.current.delete(key);
        setInFlight(new Set(inFlightRef.current));
      }
    },
    [toast],
  );

  const isPending = (assignmentId: number, action: Action) => inFlight.has(requestKey(assignmentId, action));

  return { run, isPending };
}
