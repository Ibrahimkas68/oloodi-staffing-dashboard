import type { MeasureConfig } from './config.js';
import type { Sample, ToggleAction } from './types.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** What one run reports back; the loop adds the position, the warm-up flag and the action. */
export type Outcome = Pick<Sample, 'failed' | 'ms'>;

/**
 * Runs `runOnce` warmupRuns + measuredRuns times, strictly one after the other with a quiet pause
 * between runs, and never resets anything in between. Warm-up samples are kept and flagged.
 * Runs alternate between the two toggle actions, so the measured set splits evenly when the
 * warm-up count is even.
 *
 * Samples go into the caller's array as they are taken, so when a run throws (the harness is in a
 * state it did not expect) everything measured so far is still there to be written out.
 */
export async function runLoop<Extra extends object>(
  label: string,
  config: MeasureConfig,
  firstAction: ToggleAction,
  runOnce: (action: ToggleAction) => Promise<Outcome & Extra>,
  samples: (Sample & Extra)[],
): Promise<void> {
  const total = config.warmupRuns + config.measuredRuns;
  let action = firstAction;
  for (let index = 0; index < total; index += 1) {
    const warmup = index < config.warmupRuns;
    const result = await runOnce(action);
    samples.push({ index, warmup, action, ...result });
    console.log(
      `  ${label} ${index + 1}/${total}${warmup ? ' (warm-up)' : ''} ${action}: ${describe(result)}`,
    );
    action = action === 'cancel' ? 'accept' : 'cancel';
    await sleep(config.settleMs);
  }
}

function describe(result: Outcome): string {
  return result.failed ? 'FAILED (timed out)' : `${result.ms} ms`;
}
