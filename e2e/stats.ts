export type Summary = {
  count: number;
  min: number;
  median: number;
  /** Nearest rank: the value at position ceil(0.95 * n) of the sorted samples. */
  p95: number;
  max: number;
  mean: number;
};

/** Label to print next to a p95 column: with 20 samples it is just the 19th value. */
export const P95_LABEL = 'p95 (nearest rank, indicative with 20 samples)';

const P95_RANK = 0.95;

/** Median of an already sorted, non-empty list. For an even count: the mean of the two middle values. */
function medianOfSorted(sorted: number[]): number {
  const middle = sorted.length / 2;
  if (Number.isInteger(middle)) return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
  return sorted[Math.floor(middle)] ?? 0;
}

/** Summary statistics of a list of samples (milliseconds). Throws on an empty list. */
export function summarize(samples: number[]): Summary {
  if (samples.length === 0) throw new Error('Cannot summarize an empty list of samples.');
  const sorted = [...samples].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((total, value) => total + value, 0);
  return {
    count,
    min: sorted[0] ?? 0,
    median: medianOfSorted(sorted),
    p95: sorted[Math.ceil(P95_RANK * count) - 1] ?? 0,
    max: sorted[count - 1] ?? 0,
    mean: sum / count,
  };
}
