/** What a measurement run does. Stored in the JSON next to the samples. */
export type MeasureConfig = {
  /** Runs that count, per metric. */
  measuredRuns: number;
  /** Runs before them that are kept in the JSON but left out of the statistics. */
  warmupRuns: number;
  /** How long the manager stays offline in each recovery run. */
  outageMs: number;
  /** Quiet time between two runs, so one run's tail never overlaps the next. */
  settleMs: number;
};

export const DEFAULT_CONFIG: MeasureConfig = {
  measuredRuns: 20,
  warmupRuns: 6,
  outageMs: 5_000,
  settleMs: 250,
};

/** SC-005: median update delay must be under this. */
export const SC005_MEDIAN_LIMIT_MS = 1_000;
/** SC-006: every recovery must be under this. */
export const SC006_LIMIT_MS = 15_000;

/** A run that waits longer than this for the manager to show the change is recorded as failed. */
export const UPDATE_TIMEOUT_MS = 10_000;
export const RECOVERY_TIMEOUT_MS = 30_000;

/**
 * The client probes the network 10 s after an `offline` event (OFFLINE_PROBE_MS in
 * web/src/lib/live.ts). An outage that long would let that probe, not the network coming back,
 * trigger the recovery, so the outage must stay clearly below it.
 */
export const OFFLINE_PROBE_MS = 10_000;
const MAX_OUTAGE_MS = OFFLINE_PROBE_MS - 2_000;

function integerFromEnv(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  minimum: number,
): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${name} must be a whole number of at least ${minimum}, got "${raw}".`);
  }
  return value;
}

/**
 * Reads the run configuration. The MEASURE_* variables exist for development and smoke tests (for
 * example MEASURE_RUNS=3 MEASURE_WARMUP=1). The official measurement uses the defaults.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): MeasureConfig {
  const config: MeasureConfig = {
    measuredRuns: integerFromEnv(env, 'MEASURE_RUNS', DEFAULT_CONFIG.measuredRuns, 1),
    warmupRuns: integerFromEnv(env, 'MEASURE_WARMUP', DEFAULT_CONFIG.warmupRuns, 0),
    outageMs: integerFromEnv(env, 'MEASURE_OUTAGE_MS', DEFAULT_CONFIG.outageMs, 1_000),
    settleMs: DEFAULT_CONFIG.settleMs,
  };
  if (config.outageMs > MAX_OUTAGE_MS) {
    throw new Error(
      `MEASURE_OUTAGE_MS must be at most ${MAX_OUTAGE_MS}: longer outages meet the 10 s probe.`,
    );
  }
  return config;
}
