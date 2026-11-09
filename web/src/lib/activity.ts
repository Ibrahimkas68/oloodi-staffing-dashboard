import type { Action, ActivityEvent } from '@staffing/shared';
import { firstName } from './format.js';

/** What happened, in the past tense, to follow the worker's first name ("Amina checked in"). */
const VERB: Record<Action, string> = {
  invite: 'was invited',
  accept: 'accepted',
  decline: 'declined',
  cancel: 'released their spot',
  check_in: 'checked in',
  check_out: 'checked out',
};

export function describeEvent(event: ActivityEvent): { name: string; verb: string } {
  return { name: firstName(event.workerName), verb: VERB[event.action] };
}
