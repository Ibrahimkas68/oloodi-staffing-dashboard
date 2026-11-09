import { describe, expect, it } from 'vitest';
import { formatDay, formatTime } from '../src/lib/format.js';

// Dates are built from local parts so the tests do not depend on the machine's time zone.
describe('formatTime', () => {
  it('uses the 24-hour clock', () => {
    expect(formatTime(new Date(2026, 10, 8, 14, 5))).toBe('14:05');
    expect(formatTime(new Date(2026, 10, 8, 0, 30))).toBe('00:30');
  });

  it('accepts an ISO string or a timestamp', () => {
    const at = new Date(2026, 10, 8, 9, 7);
    expect(formatTime(at.toISOString())).toBe('09:07');
    expect(formatTime(at.getTime())).toBe('09:07');
  });

  it('shows a dash when nothing was recorded', () => {
    expect(formatTime(null)).toBe('—');
  });

  it('shows a dash instead of throwing on an invalid time', () => {
    expect(formatTime('')).toBe('—');
    expect(formatTime('not a date')).toBe('—');
  });
});

describe('formatDay', () => {
  const shiftStart = new Date(2026, 10, 8, 14).toISOString();

  it('says "Today" on the same calendar day', () => {
    expect(formatDay(shiftStart, new Date(2026, 10, 8, 9))).toMatch(/^Today, /);
  });

  it('shows only the date on another day', () => {
    const label = formatDay(shiftStart, new Date(2026, 10, 9, 9));
    expect(label).not.toContain('Today');
    expect(label).toContain('Nov');
  });
});
