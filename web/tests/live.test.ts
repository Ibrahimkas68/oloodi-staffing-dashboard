import type { Snapshot } from '@staffing/shared';
import { describe, expect, it } from 'vitest';
import { backoffDelay, shouldApply } from '../src/lib/live.js';

const snapshot = (version: number, serverTime = '2026-11-09T10:00:00.000Z') =>
  ({ version, serverTime }) as Snapshot;

describe('version guard', () => {
  it('applies the first snapshot', () => {
    expect(shouldApply(null, snapshot(0))).toBe(true);
  });

  it('applies only strictly newer versions', () => {
    expect(shouldApply(snapshot(5), snapshot(6))).toBe(true);
    expect(shouldApply(snapshot(5), snapshot(5))).toBe(false);
    expect(shouldApply(snapshot(5), snapshot(4))).toBe(false);
  });

  it('accepts a lower version as the first snapshot of a new connection after a reset', () => {
    const held = snapshot(5, '2026-11-09T10:00:00.000Z');
    const afterReset = snapshot(0, '2026-11-09T10:05:00.000Z');
    expect(shouldApply(held, afterReset, true)).toBe(true);
    expect(shouldApply(held, afterReset, false)).toBe(false);
  });

  it('ignores an older first snapshot that raced a newer commit', () => {
    const newer = snapshot(6, '2026-11-09T10:00:01.000Z');
    const builtBefore = snapshot(5, '2026-11-09T10:00:00.900Z');
    expect(shouldApply(newer, builtBefore, true)).toBe(false);
  });
});

describe('reconnect backoff', () => {
  it('waits 1 s, 2 s, 4 s, 8 s, then caps at 10 s', () => {
    expect([0, 1, 2, 3, 4, 5, 10].map(backoffDelay)).toEqual([
      1_000, 2_000, 4_000, 8_000, 10_000, 10_000, 10_000,
    ]);
  });
});
