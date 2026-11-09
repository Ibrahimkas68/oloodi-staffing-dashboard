import { describe, expect, it } from 'vitest';
import { summarize } from '../stats.js';

describe('summarize', () => {
  it('throws on an empty list', () => {
    expect(() => summarize([])).toThrow(/empty/);
  });

  it('handles a single sample', () => {
    expect(summarize([7])).toEqual({ count: 1, min: 7, median: 7, p95: 7, max: 7, mean: 7 });
  });

  it('takes the middle value for an odd count, whatever the input order', () => {
    expect(summarize([9, 1, 5]).median).toBe(5);
  });

  it('takes the mean of the two middle values for an even count', () => {
    expect(summarize([4, 1, 3, 2]).median).toBe(2.5);
  });

  it('uses the 19th sorted value as p95 for 20 samples', () => {
    const samples = Array.from({ length: 20 }, (_, index) => (index + 1) * 10).reverse();
    expect(summarize(samples)).toMatchObject({
      count: 20,
      min: 10,
      p95: 190,
      max: 200,
      median: 105,
      mean: 105,
    });
  });

  it('uses nearest rank for other sizes', () => {
    expect(summarize([1, 2, 3, 4, 5]).p95).toBe(5);
    expect(summarize(Array.from({ length: 100 }, (_, i) => i + 1)).p95).toBe(95);
  });

  it('does not change the input', () => {
    const samples = [3, 1, 2];
    summarize(samples);
    expect(samples).toEqual([3, 1, 2]);
  });
});
