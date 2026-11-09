import { spawn, type ChildProcess } from 'node:child_process';
import { REPO_ROOT, START_APP, serverEnvironment } from '../env.js';
import { isAnswering, waitForHealth, waitUntilGone } from './health.js';

const SERVER_START_TIMEOUT_MS = 120_000;
const STOP_TIMEOUT_MS = 10_000;
const KEPT_OUTPUT_CHARS = 4_000;

export type RunningApp = { stop: () => Promise<void> };

/** Signals the whole process group: `sh`, npm and node all die together. */
function killGroup(child: ChildProcess, signal: 'SIGTERM' | 'SIGKILL' = 'SIGTERM'): void {
  if (child.pid === undefined) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    // Already gone.
  }
}

/** Keeps the tail of the server's output, to show only if startup fails. */
function captureOutput(child: ChildProcess): () => string {
  let tail = '';
  const keep = (chunk: Buffer) => {
    tail = (tail + chunk.toString()).slice(-KEPT_OUTPUT_CHARS);
  };
  child.stdout?.on('data', keep);
  child.stderr?.on('data', keep);
  return () => tail;
}

// Exit codes follow the shell convention: 128 plus the signal number.
const SIGNAL_EXIT_CODES = { SIGINT: 130, SIGTERM: 143, SIGHUP: 129 } as const;

function onProcessEnd(child: ChildProcess, stop: () => Promise<void>): void {
  process.on('exit', () => killGroup(child, 'SIGKILL'));
  // SIGHUP: closing the terminal window. Without it the detached server would be left running.
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.once(signal, () => void stop().finally(() => process.exit(SIGNAL_EXIT_CODES[signal])));
  }
}

/**
 * Starts the app under test the same way the Playwright config does (same command, same
 * environment), on the e2e port and e2e database.
 *
 * It refuses to start when something already answers on the port: that server could be using
 * another database, and measuring it would be measuring the wrong thing.
 */
export async function startLocalApp(baseUrl: string): Promise<RunningApp> {
  if (await isAnswering(`${baseUrl}/api/health`)) {
    throw new Error(
      `Something already answers at ${baseUrl}. Stop it first: it may use another database.`,
    );
  }

  const child = spawn('sh', ['-c', START_APP], {
    cwd: REPO_ROOT,
    // Own process group, so stop() can end the server and everything npm started for it.
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...serverEnvironment() },
  });
  const output = captureOutput(child);
  const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
  let exitCode: number | null | undefined;
  child.once('exit', (code) => (exitCode = code));

  let stopping: Promise<void> | undefined;
  const stop = () => (stopping ??= endApp());
  async function endApp(): Promise<void> {
    killGroup(child);
    const timedOut = Symbol('timed out');
    const outcome = await Promise.race([
      exited,
      new Promise<typeof timedOut>((resolve) =>
        setTimeout(() => resolve(timedOut), STOP_TIMEOUT_MS),
      ),
    ]);
    // A server that ignores SIGTERM (hung in its graceful shutdown) must not stay on the port.
    if (outcome === timedOut) {
      console.warn('The server did not stop on SIGTERM; killing it.');
      killGroup(child, 'SIGKILL');
    }
    if (!(await waitUntilGone(baseUrl, STOP_TIMEOUT_MS))) {
      console.warn(`Warning: something still answers at ${baseUrl} after the server was stopped.`);
    }
  }
  onProcessEnd(child, stop);

  try {
    await waitForHealth(baseUrl, SERVER_START_TIMEOUT_MS, () =>
      exitCode === undefined
        ? null
        : new Error(`The server exited with code ${exitCode} before it was ready.`),
    );
  } catch (error) {
    await stop();
    console.error(output());
    throw error;
  }
  return { stop };
}
