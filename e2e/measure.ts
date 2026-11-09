import { chromium } from '@playwright/test';
import { resetDatabase } from './db.js';
import { e2eTarget, type E2eTarget } from './env.js';
import { analyse } from './measure/analysis.js';
import { loadConfig } from './measure/config.js';
import { collectEnvironment } from './measure/environment.js';
import { waitForHealth } from './measure/health.js';
import { startLocalApp, type RunningApp } from './measure/local-app.js';
import { measureRecovery } from './measure/recovery.js';
import { formatReport, writeResults, type Results } from './measure/report.js';
import { openSession } from './measure/session.js';
import { measureUpdateDelay } from './measure/update-delay.js';

const EXTERNAL_APP_TIMEOUT_MS = 120_000;

/** Local mode starts (and later stops) its own server; external mode only waits for the container's. */
async function startApp(target: E2eTarget): Promise<RunningApp> {
  if (target.mode === 'local') return startLocalApp(target.baseUrl);
  await waitForHealth(target.baseUrl, EXTERNAL_APP_TIMEOUT_MS);
  return { stop: async () => undefined };
}

/**
 * Measures update delay and recovery time (FR-027, SC-005, SC-006). The database is reset once,
 * before the pages connect, and never between runs. Run it with `npm run measure` (host) or
 * `npm run measure:docker` (container); see docs/measurements.md.
 */
async function main(): Promise<void> {
  const target = e2eTarget();
  const config = loadConfig();
  const app = await startApp(target);
  try {
    resetDatabase();
    const browser = await chromium.launch({ headless: true });
    try {
      const session = await openSession(browser, target.baseUrl);
      // The loops fill these arrays as they go, so an unexpected failure still leaves every sample
      // taken so far to be reported. An aborted run is written out and marked, never silently lost.
      const results: Results = { updateDelay: [], recovery: [], aborted: null };
      try {
        console.log('Update delay runs');
        await measureUpdateDelay(session, config, results.updateDelay);
        console.log('Recovery runs');
        await measureRecovery(session, config, results.recovery);
      } catch (error) {
        results.aborted = error instanceof Error ? error.message : String(error);
        process.exitCode = 1;
      } finally {
        await session.close();
      }

      const mode = target.mode === 'local' ? 'local-host' : 'container';
      const environment = collectEnvironment(mode, browser.version(), config);
      const analysis = analyse(results.updateDelay, results.recovery, results.aborted);
      console.log(`\n${formatReport(environment, results, analysis)}`);
      console.log(`\nRaw samples written to ${writeResults(environment, results, analysis)}`);
    } finally {
      await browser.close();
    }
  } finally {
    await app.stop();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
