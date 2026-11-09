import type { Assignment, Snapshot } from '@staffing/shared';
import { describe, expect, it } from 'vitest';
import { formatDuration, joinNames, readinessSentence } from '../src/lib/readiness.js';

const HOUR = 3_600_000;
const START = Date.parse('2026-11-09T14:00:00.000Z');

function assignment(
  name: string,
  participation: Assignment['participation'],
  attendance: Assignment['attendance'],
) {
  return { id: 1, worker: { id: 1, fullName: name }, participation, attendance } as Assignment;
}

function snapshot(assignments: Assignment[], required = 3): Snapshot {
  const filled = assignments.filter((a) => a.participation === 'accepted').length;
  return {
    shift: {
      startsAt: new Date(START).toISOString(),
      endsAt: new Date(START + 4 * HOUR).toISOString(),
      requiredWorkers: required,
    },
    counts: { filled },
    assignments,
  } as unknown as Snapshot;
}

describe('formatDuration', () => {
  it('uses minutes, hours, and days', () => {
    expect(formatDuration(0)).toBe('1 min');
    expect(formatDuration(45 * 60_000)).toBe('45 min');
    expect(formatDuration(3 * HOUR)).toBe('3h');
    expect(formatDuration(2 * HOUR + 15 * 60_000)).toBe('2h 15min');
    expect(formatDuration(24 * HOUR)).toBe('1 day');
    expect(formatDuration(50 * HOUR)).toBe('2 days');
  });
});

describe('joinNames', () => {
  it('reads as a sentence', () => {
    expect(joinNames(['Salma'])).toBe('Salma');
    expect(joinNames(['Salma', 'Youssef'])).toBe('Salma and Youssef');
    expect(joinNames(['Salma', 'Youssef', 'Amina'])).toBe('Salma, Youssef and Amina');
  });
});

describe('readinessSentence', () => {
  const now = START - 3 * HOUR;

  it('says who accepted but has not checked in', () => {
    const state = snapshot([
      assignment('Amina Elamrani', 'accepted', 'checked_in'),
      assignment('Salma Idrissi', 'accepted', 'not_started'),
      assignment('Youssef Bennani', 'invited', 'not_started'),
    ]);
    expect(readinessSentence(state, now)).toBe(
      '2 of 3 places filled · starts in 3h · Salma accepted, not checked in yet',
    );
  });

  it('omits the waiting part when nobody is waiting', () => {
    const state = snapshot([assignment('Amina Elamrani', 'accepted', 'checked_in')]);
    expect(readinessSentence(state, now)).toBe('1 of 3 places filled · starts in 3h');
  });

  it('handles an empty shift', () => {
    expect(
      readinessSentence(snapshot([assignment('Amina Elamrani', 'uninvited', 'not_started')]), now),
    ).toBe('0 of 3 places filled · starts in 3h');
  });

  it('describes a shift that has started or ended', () => {
    const state = snapshot([assignment('Amina Elamrani', 'accepted', 'checked_in')]);
    expect(readinessSentence(state, START + 30 * 60_000)).toContain('started 30 min ago');
    expect(readinessSentence(state, START + 5 * HOUR)).toContain('has ended');
  });

  it('says the shift is complete when everyone accepted has checked out', () => {
    const state = snapshot([
      assignment('Amina Elamrani', 'accepted', 'checked_out'),
      assignment('Salma Idrissi', 'accepted', 'checked_out'),
      assignment('Youssef Bennani', 'declined', 'not_started'),
    ]);
    expect(readinessSentence(state, now)).toBe('Shift complete');
  });

  it('is not complete while one accepted worker is still on site', () => {
    const state = snapshot([
      assignment('Amina Elamrani', 'accepted', 'checked_out'),
      assignment('Salma Idrissi', 'accepted', 'checked_in'),
    ]);
    expect(readinessSentence(state, now)).not.toBe('Shift complete');
  });
});
