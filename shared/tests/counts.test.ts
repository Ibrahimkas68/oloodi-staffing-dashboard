import { describe, expect, it } from 'vitest';
import { deriveCounts } from '../src/counts.js';
import type { AssignmentState } from '../src/types.js';

const s = (participation: AssignmentState['participation'], attendance: AssignmentState['attendance'] = 'not_started') => ({
  participation,
  attendance,
});

describe('deriveCounts', () => {
  it('seed: nobody filled', () => {
    const counts = deriveCounts([s('uninvited'), s('uninvited'), s('uninvited')], 3);
    expect(counts).toMatchObject({ filled: 0, remaining: 3, checkedIn: 0, checkedOut: 0, uninvited: 3 });
  });

  it('mid-shift: invited is not filled, checked in is filled', () => {
    const counts = deriveCounts([s('accepted', 'checked_in'), s('declined'), s('accepted')], 3);
    expect(counts).toMatchObject({ filled: 2, remaining: 1, checkedIn: 1, checkedOut: 0, declined: 1 });
  });

  it('end of shift: checked-out workers still count as filled', () => {
    const counts = deriveCounts(
      [s('accepted', 'checked_out'), s('accepted', 'checked_out'), s('accepted', 'checked_out')],
      3,
    );
    expect(counts).toMatchObject({ filled: 3, remaining: 0, checkedIn: 0, checkedOut: 3 });
  });

  it('cancelled and invited do not fill places', () => {
    const counts = deriveCounts([s('cancelled'), s('invited'), s('accepted')], 3);
    expect(counts).toMatchObject({ filled: 1, remaining: 2, cancelled: 1, invited: 1 });
  });

  it('filled + remaining always equals required', () => {
    const lists = [[s('accepted')], [s('accepted'), s('accepted', 'checked_out')], []];
    for (const list of lists) {
      const counts = deriveCounts(list, 3);
      expect(counts.filled + counts.remaining).toBe(3);
    }
  });
});
