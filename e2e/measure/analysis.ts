import { SC005_MEDIAN_LIMIT_MS, SC006_LIMIT_MS } from './config.js';
import { summarize, type Summary } from '../stats.js';
import type { RecoverySample, Sample, ToggleAction } from './types.js';

export type MetricAnalysis = {
  /** Measured (not warm-up) runs, failed ones included. */
  measuredRuns: number;
  failedRuns: number;
  /** Statistics over the measured runs that did not fail; null when there are none. */
  stats: Summary | null;
  byAction: Record<ToggleAction, Summary | null>;
};

export type Analysis = {
  updateDelay: MetricAnalysis;
  recovery: MetricAnalysis;
  /** Measured recovery runs where the browser fired `online`, and those where it did not. */
  recoveryPaths: { onlineEvent: number; noOnlineEvent: number };
  sc005Met: boolean;
  sc006Met: boolean;
};

function summarizeOrNull(samples: Sample[]): Summary | null {
  const values = samples.flatMap((sample) => (sample.ms === null ? [] : [sample.ms]));
  return values.length === 0 ? null : summarize(values);
}

function analyseMetric(samples: Sample[]): MetricAnalysis {
  const measured = samples.filter((sample) => !sample.warmup);
  const ofAction = (action: ToggleAction) => measured.filter((sample) => sample.action === action);
  return {
    measuredRuns: measured.length,
    failedRuns: measured.filter((sample) => sample.failed).length,
    stats: summarizeOrNull(measured),
    byAction: {
      cancel: summarizeOrNull(ofAction('cancel')),
      accept: summarizeOrNull(ofAction('accept')),
    },
  };
}

/**
 * Statistics and the SC-005 / SC-006 checks. Warm-up runs never count. `aborted` is the reason the
 * run stopped early, or null when every loop finished.
 */
export function analyse(
  updateDelay: Sample[],
  recovery: RecoverySample[],
  aborted: string | null,
): Analysis {
  const update = analyseMetric(updateDelay);
  const recovered = analyseMetric(recovery);
  const measuredRecovery = recovery.filter((sample) => !sample.warmup);
  const onlineEvent = measuredRecovery.filter((sample) => sample.path === 'online-event').length;
  return {
    updateDelay: update,
    recovery: recovered,
    recoveryPaths: { onlineEvent, noOnlineEvent: measuredRecovery.length - onlineEvent },
    // A run that failed to show the change at all must count against the criterion: the median of
    // only the runs that worked would hide it. An aborted run never meets a criterion either.
    sc005Met:
      aborted === null &&
      update.failedRuns === 0 &&
      update.stats !== null &&
      update.stats.median < SC005_MEDIAN_LIMIT_MS,
    sc006Met:
      aborted === null &&
      recovered.stats !== null &&
      recovered.failedRuns === 0 &&
      recovered.stats.max < SC006_LIMIT_MS,
  };
}
