import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { P95_LABEL, type Summary } from '../stats.js';
import type { Analysis, MetricAnalysis } from './analysis.js';
import { SC005_MEDIAN_LIMIT_MS, SC006_LIMIT_MS } from './config.js';
import { formatEnvironment, type Environment } from './environment.js';
import type { RecoverySample, Sample } from './types.js';

export type Results = {
  updateDelay: Sample[];
  recovery: RecoverySample[];
  /** Why the run stopped before every loop finished; null for a complete run. */
  aborted: string | null;
};

const RESULTS_DIR = fileURLToPath(new URL('../measure-results/', import.meta.url));
const TEXT_HEADER = ['metric', 'n', 'min', 'median', 'p95', 'max (ms)'];

const number = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

function statsRow(name: string, stats: Summary | null): string[] {
  if (stats === null) return [name, '0', '-', '-', '-', '-'];
  return [
    name,
    String(stats.count),
    ...[stats.min, stats.median, stats.p95, stats.max].map(number),
  ];
}

function metricRows(analysis: Analysis): string[][] {
  return [
    statsRow('update delay', analysis.updateDelay.stats),
    statsRow('recovery', analysis.recovery.stats),
  ];
}

function textTable(rows: string[][]): string[] {
  const all = [TEXT_HEADER, ...rows];
  const widths = all[0]!.map((_, column) => Math.max(...all.map((row) => row[column]!.length)));
  return all.map((row) =>
    row
      .map((cell, column) => cell.padEnd(widths[column]!))
      .join('  ')
      .trimEnd(),
  );
}

/** The block to paste into docs/measurements.md. */
function markdownTable(analysis: Analysis): string[] {
  const row = (cells: string[]) => `| ${cells.join(' | ')} |`;
  return [
    row(['Metric', 'n', 'min (ms)', 'median (ms)', 'p95 (ms)', 'max (ms)']),
    row(['---', '---:', '---:', '---:', '---:', '---:']),
    ...metricRows(analysis).map(row),
    '',
    'p95 is the nearest rank value, indicative with 20 samples.',
  ];
}

function failedLine(name: string, metric: MetricAnalysis): string {
  return `${name}: ${metric.failedRuns} failed of ${metric.measuredRuns} measured runs`;
}

function splitLine(metric: MetricAnalysis): string {
  const part = (action: 'cancel' | 'accept') => {
    const stats = metric.byAction[action];
    return stats
      ? `${action} n=${stats.count} median ${number(stats.median)} max ${number(stats.max)}`
      : `${action} none`;
  };
  return `${part('cancel')}; ${part('accept')}`;
}

function recoveryPathLines(analysis: Analysis, recovery: RecoverySample[]): string[] {
  const { onlineEvent, noOnlineEvent } = analysis.recoveryPaths;
  const delays = recovery
    .filter((s) => !s.warmup && s.onlineEventMs !== null)
    .map((s) => s.onlineEventMs);
  return [
    `Recovery path: the browser fired "online" in ${onlineEvent} measured runs and not in ${noOnlineEvent}.`,
    `Time from restoring the network to the "online" event (ms, measured runs): ${delays.length ? delays.join(', ') : 'never fired'}`,
  ];
}

const verdict = (met: boolean, aborted: string | null) =>
  met
    ? 'met in this run'
    : aborted === null
      ? 'not met in this run'
      : 'not met (the run was aborted)';

function abortedLines(aborted: string | null): string[] {
  if (aborted === null) return [];
  return [
    `RUN ABORTED: ${aborted}`,
    'The numbers below cover only the runs finished before the abort. Do not use them as results.',
    '',
  ];
}

/** Everything the run prints, in order: environment, table, failures, split, verdicts, docs block. */
export function formatReport(env: Environment, results: Results, analysis: Analysis): string {
  return [
    `Measurement run (${env.mode})`,
    '',
    ...abortedLines(results.aborted),
    ...formatEnvironment(env),
    '',
    ...textTable(metricRows(analysis)),
    `(${P95_LABEL})`,
    '',
    failedLine('Update delay', analysis.updateDelay),
    failedLine('Recovery', analysis.recovery),
    `Update delay by action: ${splitLine(analysis.updateDelay)}`,
    `Recovery by action: ${splitLine(analysis.recovery)}`,
    ...recoveryPathLines(analysis, results.recovery),
    '',
    `SC-005 (median update delay under ${SC005_MEDIAN_LIMIT_MS} ms): ${verdict(analysis.sc005Met, results.aborted)}`,
    `SC-006 (every recovery under ${SC006_LIMIT_MS} ms, none failed): ${verdict(analysis.sc006Met, results.aborted)}`,
    '',
    'Markdown for docs/measurements.md:',
    '',
    ...markdownTable(analysis),
  ].join('\n');
}

/** Writes every sample, flagged, with the environment and the statistics. Returns the file path. */
export function writeResults(env: Environment, results: Results, analysis: Analysis): string {
  mkdirSync(RESULTS_DIR, { recursive: true });
  const stamp = env.date.replace(/[:.]/g, '-');
  const path = `${RESULTS_DIR}${env.mode}-${stamp}.json`;
  const document = { environment: env, samples: results, analysis };
  writeFileSync(path, `${JSON.stringify(document, null, 2)}\n`);
  return path;
}
