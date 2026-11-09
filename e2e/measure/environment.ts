import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import os from 'node:os';
import { REPO_ROOT } from '../env.js';
import type { MeasureConfig } from './config.js';
import type { RunMode } from './types.js';

export type Environment = {
  /** `local-host`: Node and Chromium on this machine. `container`: inside the Linux e2e container. */
  mode: RunMode;
  date: string;
  cpuModel: string;
  cpuCores: number;
  ramGiB: number;
  /** In a container this is the Linux VM, not the physical machine. */
  os: string;
  osProductVersion: string | null;
  hardwareModel: string | null;
  powerSource: string | null;
  node: string;
  chromium: string;
  playwright: string;
  headless: true;
  gitCommit: string | null;
  gitDirty: boolean | null;
  dockerInfo: string | null;
  config: MeasureConfig;
};

const COMMAND_TIMEOUT_MS = 5_000;
const BYTES_PER_GIB = 1024 ** 3;

/** Runs a command and returns its trimmed output (possibly empty), or null if it is missing or fails. */
function run(command: string, args: string[]): string | null {
  try {
    return execFileSync(command, args, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      timeout: COMMAND_TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

/** Like `run`, but empty output counts as nothing to report. */
const probe = (command: string, args: string[]): string | null => run(command, args) || null;

/** The wrapper script writes "unknown" when it could not find something out. */
const knownValue = (value: string | undefined): string | null =>
  value && value !== 'unknown' ? value : null;

function playwrightVersion(): string {
  try {
    const manifest = createRequire(import.meta.url)('@playwright/test/package.json') as {
      version: string;
    };
    return manifest.version;
  } catch {
    return 'unknown';
  }
}

/** Commit and dirty flag. In the container there is no .git (it is not copied), so the wrapper passes them in. */
function gitState(mode: RunMode): Pick<Environment, 'gitCommit' | 'gitDirty'> {
  if (mode === 'container') {
    const dirty = process.env.MEASURE_GIT_DIRTY;
    return {
      gitCommit: knownValue(process.env.MEASURE_GIT_COMMIT),
      gitDirty: dirty === undefined || dirty === '' ? null : dirty === 'true',
    };
  }
  // Empty output means a clean tree; a failed command means we do not know.
  const status = run('git', ['status', '--porcelain']);
  const commit = probe('git', ['rev-parse', '--short', 'HEAD']);
  return { gitCommit: commit, gitDirty: commit === null || status === null ? null : status !== '' };
}

/** Facts about the machine and the tools, for the printed report and the JSON. Never throws. */
export function collectEnvironment(
  mode: RunMode,
  chromium: string,
  config: MeasureConfig,
): Environment {
  const cpus = os.cpus();
  const onMac = os.platform() === 'darwin';
  return {
    mode,
    date: new Date().toISOString(),
    cpuModel: cpus[0]?.model.trim() ?? 'unknown',
    cpuCores: cpus.length,
    ramGiB: Math.round((os.totalmem() / BYTES_PER_GIB) * 10) / 10,
    os: `${os.platform()} ${os.release()} ${os.arch()}`,
    osProductVersion: onMac ? probe('sw_vers', ['-productVersion']) : null,
    hardwareModel: onMac ? probe('sysctl', ['-n', 'hw.model']) : null,
    // Battery or plugged in changes CPU throttling: note it by hand as well.
    powerSource: onMac ? (probe('pmset', ['-g', 'batt'])?.split('\n')[0] ?? null) : null,
    node: process.version,
    chromium,
    playwright: playwrightVersion(),
    headless: true,
    ...gitState(mode),
    dockerInfo: knownValue(process.env.MEASURE_DOCKER_INFO),
    config,
  };
}

const orNotAvailable = (value: string | null) => value ?? 'not available';

export function formatEnvironment(env: Environment): string[] {
  const { config } = env;
  const git =
    env.gitCommit === null
      ? 'not available'
      : `${env.gitCommit}${env.gitDirty ? ' (uncommitted changes)' : ''}`;
  const lines = [
    `Mode:          ${env.mode}`,
    `Date:          ${env.date}`,
    `CPU:           ${env.cpuModel}, ${env.cpuCores} cores`,
    `RAM:           ${env.ramGiB} GiB`,
    `OS:            ${env.os}${env.osProductVersion ? ` (macOS ${env.osProductVersion})` : ''}`,
    `Hardware:      ${orNotAvailable(env.hardwareModel)}`,
    `Power source:  ${orNotAvailable(env.powerSource)}`,
    `Node:          ${env.node}`,
    `Chromium:      ${env.chromium} (headless)`,
    `Playwright:    ${env.playwright}`,
    `Git commit:    ${git}`,
  ];
  if (env.dockerInfo) lines.push(`Docker host:   ${env.dockerInfo}`);
  lines.push(
    `Runs:          ${config.measuredRuns} measured + ${config.warmupRuns} warm-up per metric, outage ${config.outageMs} ms, settle ${config.settleMs} ms`,
  );
  if (env.mode === 'container') {
    lines.push(
      'Note:          in the container, CPU, RAM and OS above describe the Linux VM, not the Mac.',
    );
  }
  return lines;
}
