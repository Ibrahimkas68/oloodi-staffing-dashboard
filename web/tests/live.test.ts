import type { Snapshot } from '@staffing/shared';
import { describe, expect, it } from 'vitest';
import { backoffDelay, shouldApply } from '../src/lib/live.js';

const snapshot = (version: number) => ({ version }) as Snapshot;

describe('version guard', () => {
  it('applies the first snapshot', () => {
    expect(shouldApply(null, snapshot(0))).toBe(true);
  });

  it('applies only strictly newer versions', () => {
    expect(shouldApply(snapshot(5), snapshot(6))).toBe(true);
    expect(shouldApply(snapshot(5), snapshot(5))).toBe(false);
    expect(shouldApply(snapshot(5), snapshot(4))).toBe(false);
  });
});

describe('reconnect backoff', () => {
  it('waits 1 s, 2 s, 4 s, 8 s, then caps at 10 s', () => {
    expect([0, 1, 2, 3, 4, 5, 10].map(backoffDelay)).toEqual([
      1_000, 2_000, 4_000, 8_000, 10_000, 10_000, 10_000,
    ]);
  });
});
