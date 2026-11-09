import type { AssignmentState } from '@staffing/shared';
import { describe, expect, it } from 'vitest';
import { actionLabel, workerView } from '../src/lib/workerView.js';

const state = (participation: AssignmentState['participation'], attendance: AssignmentState['attendance'] = 'not_started') => ({
  participation,
  attendance,
});

describe('workerView', () => {
  it('uninvited: no buttons (invite is a manager action) and a waiting panel', () => {
    const view = workerView(state('uninvited'));
    expect(view.actions).toEqual([]);
    expect(view.message).toMatchObject({ tone: 'info', title: 'No invitation yet' });
  });

  it('invited: accept first, then decline', () => {
    expect(workerView(state('invited'))).toEqual({ actions: ['accept', 'decline'], message: undefined });
  });

  it('declined: no buttons, final message', () => {
    const view = workerView(state('declined'));
    expect(view.actions).toEqual([]);
    expect(view.message).toEqual({ tone: 'final', text: 'You declined this shift. Thanks for letting us know.' });
  });

  it('cancelled: accept again, with a hint', () => {
    const view = workerView(state('cancelled'));
    expect(view.actions).toEqual(['accept']);
    expect(view.message).toMatchObject({ tone: 'hint', text: expect.stringContaining('accept again') });
  });

  it('accepted, not started: check in first, cancel last', () => {
    expect(workerView(state('accepted')).actions).toEqual(['check_in', 'cancel']);
  });

  it('accepted and checked in: only check out (cancel is no longer allowed)', () => {
    expect(workerView(state('accepted', 'checked_in')).actions).toEqual(['check_out']);
  });

  it('accepted and checked out: no buttons, final message with the time', () => {
    const iso = new Date(2026, 10, 8, 18, 5).toISOString();
    const view = workerView({ ...state('accepted', 'checked_out'), checkedOutAt: iso });
    expect(view.actions).toEqual([]);
    expect(view.message).toEqual({ tone: 'final', icon: 'check', text: 'You checked out at 18:05. Thanks!' });
  });

  it('checked out without a recorded time still thanks the worker', () => {
    expect(workerView(state('accepted', 'checked_out')).message?.text).toBe('You checked out. Thanks!');
  });

  it('never offers a manager action', () => {
    const participations = ['uninvited', 'invited', 'accepted', 'declined', 'cancelled'] as const;
    for (const participation of participations) {
      expect(workerView(state(participation)).actions).not.toContain('invite');
    }
  });
});

describe('actionLabel', () => {
  it('says "Accept again" only after a cancellation', () => {
    expect(actionLabel('accept', state('invited'))).toBe('Accept');
    expect(actionLabel('accept', state('cancelled'))).toBe('Accept again');
    expect(actionLabel('cancel', state('accepted'))).toBe('Cancel my spot');
  });
});
