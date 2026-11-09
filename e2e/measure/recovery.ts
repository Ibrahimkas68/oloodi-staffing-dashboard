import { waitForStatus, waitLive } from '../live.js';
import { OFFLINE_PROBE_MS, RECOVERY_TIMEOUT_MS, type MeasureConfig } from './config.js';
import {
  armWatch,
  awaitWatch,
  readOnlineClock,
  readParticipation,
  resetOnlineClock,
} from './probes.js';
import { runLoop, type Outcome } from './run-loop.js';
import { AMINA_ROW, type Session } from './session.js';
import { actionFrom, clickAction, expectedManagerText, waitForNextButton } from './toggle.js';
import type { RecoveryPath, RecoverySample, ToggleAction } from './types.js';

const OFFLINE_REACTION_TIMEOUT_MS = 5_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type RecoveryOutcome = Outcome & Pick<RecoverySample, 'onlineEventMs' | 'path'>;

/**
 * Takes the manager offline, lets the worker change the state meanwhile, holds the outage for
 * outageMs, then restores the network and times how long the manager takes to show the new state
 * with a Live badge.
 */
async function measureOnce(
  { manager, worker, managerContext }: Session,
  config: MeasureConfig,
  action: ToggleAction,
): Promise<RecoveryOutcome> {
  // Every run starts with both pages Live, so a slow run before it cannot leak into this one.
  await Promise.all([waitLive(manager), waitLive(worker)]);
  const expectedText = expectedManagerText(action);
  const oldText = await readParticipation(manager, AMINA_ROW);
  await resetOnlineClock(manager);

  const outageStart = Date.now();
  await managerContext.setOffline(true);
  await waitForStatus(manager, 'offline', OFFLINE_REACTION_TIMEOUT_MS);

  // The worker is online, so its change reaches the server while the manager cannot hear about it.
  await clickAction(worker, action);
  await waitForNextButton(worker, action);
  const stale = await readParticipation(manager, AMINA_ROW);
  if (stale !== oldText)
    throw new Error(
      `The offline manager changed from "${oldText}" to "${stale}" during the outage.`,
    );

  // Hold the outage for outageMs in total. It must end well before the client's 10 s probe, or the
  // probe (not the network coming back) would be what we measure.
  await sleep(Math.max(0, config.outageMs - (Date.now() - outageStart)));
  if (Date.now() - outageStart >= OFFLINE_PROBE_MS)
    throw new Error('The outage reached the 10 s probe; the run is not valid.');

  const before = await armWatch(manager, { rowTestId: AMINA_ROW, expectedText, requireLive: true });
  if (before === expectedText)
    throw new Error(`The offline manager already shows "${expectedText}".`);

  // t0 is taken in Node right before the call, so it is a little early by the time setOffline needs
  // to reach the browser: the reported recovery is slightly conservative (longer than the truth).
  const t0 = Date.now();
  await managerContext.setOffline(false);
  const t1 = await awaitWatch(manager, RECOVERY_TIMEOUT_MS);

  const onlineAt = await readOnlineClock(manager);
  const onlineEventMs = onlineAt === null ? null : onlineAt - t0;
  const path: RecoveryPath = onlineAt === null ? 'no-online-event' : 'online-event';
  if (t1 === null) return { failed: true, ms: null, onlineEventMs, path };
  // Node and the page read the same system clock, so a negative time means the clock stepped or the
  // harness is wrong. Fail loudly instead of recording it as a sample.
  if (t1 < t0)
    throw new Error(
      `The manager timestamp (${t1}) is before the restore timestamp (${t0}): the clocks disagree.`,
    );
  return { failed: false, ms: t1 - t0, onlineEventMs, path };
}

/** Recovery time: `warmup + measured` outages, alternating the state the worker leaves behind. */
export async function measureRecovery(
  session: Session,
  config: MeasureConfig,
  samples: RecoverySample[],
): Promise<void> {
  const firstAction = actionFrom(await readParticipation(session.manager, AMINA_ROW));
  await runLoop(
    'recovery',
    config,
    firstAction,
    (action) => measureOnce(session, config, action),
    samples,
  );
}
