import { describe, expect, it } from 'vitest';
import { analyse } from '../measure/analysis.js';
import { SC005_MEDIAN_LIMIT_MS, SC006_LIMIT_MS } from '../measure/config.js';
import type { RecoverySample, Sample } from '../measure/types.js';

/** Builds `count` samples: `ms` for each, or failed ones (`ms: null`). */
function samples(values: Array<number | null>, warmup = false): Sample[] {
  return values.map((ms, index) => ({
    index,
    warmup,
    action: index % 2 === 0 ? 'cancel' : 'accept',
    failed: ms === null,
    ms,
  }));
}

function recoveries(values: Array<number | null>, warmup = false): RecoverySample[] {
  return samples(values, warmup).map((sample) => ({
    ...sample,
    onlineEventMs: 5,
    path: 'online-event',
  }));
}

const twenty = (ms: number) => Array<number>(20).fill(ms);

describe('SC-005 (median update delay)', () => {
  it('is met when every run worked and the median is under the limit', () => {
    const result = analyse(samples(twenty(200)), recoveries(twenty(500)), null);
    expect(result.sc005Met).toBe(true);
  });

  it('is not met when the median is at or over the limit', () => {
    expect(
      analyse(samples(twenty(SC005_MEDIAN_LIMIT_MS)), recoveries(twenty(500)), null).sc005Met,
    ).toBe(false);
  });

  it('counts failed runs against it: the median of the runs that worked would hide them', () => {
    // 8 of 20 runs never showed the change; the other 12 took 200 ms.
    const values: Array<number | null> = [
      ...Array<number>(12).fill(200),
      ...Array<null>(8).fill(null),
    ];
    const result = analyse(samples(values), recoveries(twenty(500)), null);

    expect(result.updateDelay.stats?.median).toBe(200);
    expect(result.updateDelay.failedRuns).toBe(8);
    expect(result.sc005Met).toBe(false);
  });

  it('ignores warm-up runs, failed or slow', () => {
    const warmup = samples([null, 9_000], true);
    const result = analyse([...warmup, ...samples(twenty(200))], recoveries(twenty(500)), null);

    expect(result.updateDelay.measuredRuns).toBe(20);
    expect(result.sc005Met).toBe(true);
  });
});

describe('SC-006 (every recovery under the limit, none failed)', () => {
  it('is met when the slowest recovery is under the limit', () => {
    const values = [...twenty(500).slice(1), SC006_LIMIT_MS - 1];
    expect(analyse(samples(twenty(200)), recoveries(values), null).sc006Met).toBe(true);
  });

  it('is not met when the slowest recovery reaches the limit', () => {
    const values = [...twenty(500).slice(1), SC006_LIMIT_MS];
    expect(analyse(samples(twenty(200)), recoveries(values), null).sc006Met).toBe(false);
  });

  it('is not met when one recovery never happened', () => {
    const values: Array<number | null> = [...twenty(500).slice(1), null];
    expect(analyse(samples(twenty(200)), recoveries(values), null).sc006Met).toBe(false);
  });
});

describe('an aborted run', () => {
  it('meets neither criterion, however good the samples taken so far look', () => {
    const result = analyse(
      samples(twenty(200)),
      recoveries(twenty(500)),
      'the harness reached a state it did not expect',
    );

    expect(result.sc005Met).toBe(false);
    expect(result.sc006Met).toBe(false);
  });

  it('still reports what was measured before the abort', () => {
    const result = analyse(samples([100, 300]), [], 'stopped early');

    expect(result.updateDelay.stats?.median).toBe(200);
    expect(result.recovery.stats).toBeNull();
  });
});
