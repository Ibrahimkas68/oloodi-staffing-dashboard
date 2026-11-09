import { UPDATE_TIMEOUT_MS, type MeasureConfig } from './config.js';
import {
  armClickClock,
  armWatch,
  awaitWatch,
  readClickClock,
  readParticipation,
} from './probes.js';
import { runLoop, type Outcome } from './run-loop.js';
import { AMINA_ROW, type Session } from './session.js';
import { actionFrom, clickAction, expectedManagerText, waitForNextButton } from './toggle.js';
import type { Sample, ToggleAction } from './types.js';

/**
 * One run: the worker presses its button, and we time how long the manager's DOM takes to show it.
 * t0 is taken in the worker page on the click, t1 in the manager page when the cell changes.
 */
async function measureOnce({ manager, worker }: Session, action: ToggleAction): Promise<Outcome> {
  const expectedText = expectedManagerText(action);
  await armClickClock(worker);
  const before = await armWatch(manager, {
    rowTestId: AMINA_ROW,
    expectedText,
    requireLive: false,
  });
  if (before === expectedText) {
    throw new Error(
      `The manager already shows "${expectedText}" before the click: the run would measure nothing.`,
    );
  }

  await clickAction(worker, action);
  const t1 = await awaitWatch(manager, UPDATE_TIMEOUT_MS);
  // The worker is only ready for the next run once its own view has caught up.
  await waitForNextButton(worker, action);
  if (t1 === null) return { failed: true, ms: null };

  const t0 = await readClickClock(worker);
  if (t1 < t0)
    throw new Error(
      `The manager timestamp (${t1}) is before the click timestamp (${t0}): the clocks disagree.`,
    );
  return { failed: false, ms: t1 - t0 };
}

/** Update delay: `warmup + measured` runs of cancel / accept, with no database reset in between. */
export async function measureUpdateDelay(
  session: Session,
  config: MeasureConfig,
  samples: Sample[],
): Promise<void> {
  const firstAction = actionFrom(await readParticipation(session.manager, AMINA_ROW));
  await runLoop(
    'update delay',
    config,
    firstAction,
    (action) => measureOnce(session, action),
    samples,
  );
}
