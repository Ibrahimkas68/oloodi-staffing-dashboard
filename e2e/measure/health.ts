const POLL_INTERVAL_MS = 500;
const PROBE_TIMEOUT_MS = 2_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** True when anything answers (or hangs) at the url: the port is taken either way. */
export async function isAnswering(url: string): Promise<boolean> {
  try {
    await fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    return true;
  } catch (error) {
    return error instanceof Error && error.name === 'TimeoutError';
  }
}

async function isHealthy(url: string): Promise<boolean> {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) })).ok;
  } catch {
    return false;
  }
}

/**
 * Waits until the health endpoint answers 200. `failure` lets a caller stop early with a clear
 * error, for example when the server process has already died.
 */
export async function waitForHealth(
  baseUrl: string,
  timeoutMs: number,
  failure: () => Error | null = () => null,
): Promise<void> {
  const url = `${baseUrl}/api/health`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const error = failure();
    if (error) throw error;
    if (await isHealthy(url)) return;
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`${url} did not become healthy within ${timeoutMs / 1000} s.`);
}

/** Waits until nothing answers at the url any more. Returns false if it still does at the deadline. */
export async function waitUntilGone(baseUrl: string, timeoutMs: number): Promise<boolean> {
  const url = `${baseUrl}/api/health`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isAnswering(url))) return true;
    await sleep(POLL_INTERVAL_MS);
  }
  return false;
}
