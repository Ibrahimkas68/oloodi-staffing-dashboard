import type { Snapshot } from '@staffing/shared';
import { describe, expect, it } from 'vitest';
import { formatMs, updateDelayMs } from '../src/lib/metrics.js';

const snapshotWith = (version: number, event?: { version: number; at: string }) =>
  ({ version, recentEvents: event ? [event] : [] }) as unknown as Snapshot;

describe('updateDelayMs', () => {
  const at = '2026-11-09T10:00:00.000Z';
  const received = Date.parse(at) + 180;

  it('is the receive time minus the newest event time', () => {
    expect(updateDelayMs(snapshotWith(4, { version: 4, at }), received)).toBe(180);
  });

  it('is null without an event for this version', () => {
    expect(updateDelayMs(snapshotWith(0), received)).toBeNull();
    expect(updateDelayMs(snapshotWith(5, { version: 4, at }), received)).toBeNull();
  });

  it('never goes below zero when the clocks disagree', () => {
    expect(updateDelayMs(snapshotWith(4, { version: 4, at }), Date.parse(at) - 500)).toBe(0);
  });
});

describe('formatMs', () => {
  it('shows milliseconds, seconds, or a dash', () => {
    expect(formatMs(null)).toBe('—');
    expect(formatMs(180)).toBe('180 ms');
    expect(formatMs(1_460)).toBe('1.5 s');
  });
});
