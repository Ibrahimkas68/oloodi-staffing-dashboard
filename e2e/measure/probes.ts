import type { Page } from '@playwright/test';

/**
 * Small scripts that run inside the pages. All timestamps come from `Date.now()` in the page that
 * sees the event: both pages run on the same machine and share one system clock (1 ms resolution),
 * so a worker timestamp and a manager timestamp can be subtracted. `performance.now()` would not
 * work, because each page has its own time origin, and timing around Playwright calls in Node
 * would add the cost of the protocol round trips.
 */
type MeasureWindow = Window & {
  __t0?: number;
  __t1?: Promise<number>;
  __stopWatch?: () => void;
  __online?: number | null;
};

/** The participation pill is the second cell of a manager row (name, participation, attendance...). */
const PARTICIPATION_COLUMN = 1;

export type Watch = {
  rowTestId: string;
  /** Exact text the participation cell must show. */
  expectedText: string;
  /** Also wait for the connection badge to say Live (recovery runs). */
  requireLive: boolean;
};

/**
 * Worker page: stores the time of the next click. The listener is on the capture phase of the
 * window, so it runs before React's own handler and the timestamp is taken before the app reacts.
 */
export async function armClickClock(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as MeasureWindow;
    w.__t0 = undefined;
    window.addEventListener('click', () => (w.__t0 = Date.now()), { capture: true, once: true });
  });
}

export async function readClickClock(page: Page): Promise<number> {
  const t0 = await page.evaluate(() => (window as MeasureWindow).__t0);
  if (t0 === undefined)
    throw new Error('The click clock never fired: the worker click did not reach the page.');
  return t0;
}

/** Page side of the diagnostic: when did the browser fire `online`? Install once per page. */
export async function installOnlineClock(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as MeasureWindow;
    w.__online = null;
    window.addEventListener('online', () => (w.__online = Date.now()));
  });
}

export async function resetOnlineClock(page: Page): Promise<void> {
  await page.evaluate(() => ((window as MeasureWindow).__online = null));
}

export async function readOnlineClock(page: Page): Promise<number | null> {
  return page.evaluate(() => (window as MeasureWindow).__online ?? null);
}

/**
 * Manager page: starts watching the row for the first moment the participation cell shows exactly
 * the expected text (and, if asked, the badge says Live). A MutationObserver reports it in the same
 * task as the DOM write, so the timestamp is as close to the write as the browser allows.
 *
 * Returns the text the cell shows right now, so the caller can check it is not the expected text
 * already (otherwise the run would measure nothing).
 */
export async function armWatch(page: Page, watch: Watch): Promise<string> {
  return page.evaluate(
    ({ rowTestId, expectedText, requireLive, column }) => {
      const w = window as MeasureWindow;
      const row = document.querySelector(`[data-testid="${rowTestId}"]`);
      const badge = document.querySelector('[data-testid="connection-status"]');
      if (!row || !badge)
        throw new Error('The manager page has no worker row or connection badge to watch.');

      // No named helper functions in here: this code is serialized into the page, and the loader's
      // function-name helper (__name) does not exist there. Hence the repeated cell read.
      w.__t1 = new Promise<number>((resolve) => {
        const observer = new MutationObserver(() => {
          const text = (row.querySelectorAll('td')[column]?.textContent ?? '').trim();
          const live = badge.getAttribute('data-status') === 'live';
          if (text !== expectedText || (requireLive && !live)) return;
          observer.disconnect();
          resolve(Date.now());
        });
        const options = { childList: true, characterData: true, subtree: true, attributes: true };
        observer.observe(row, options);
        if (requireLive) observer.observe(badge, options);
        w.__stopWatch = () => observer.disconnect();
      });
      return (row.querySelectorAll('td')[column]?.textContent ?? '').trim();
    },
    { ...watch, column: PARTICIPATION_COLUMN },
  );
}

/**
 * Waits for the armed watch. Returns the page timestamp, or null when it timed out (the run then
 * counts as failed). Asking for a watch that was never armed is a bug in the harness and throws.
 */
export async function awaitWatch(page: Page, timeoutMs: number): Promise<number | null> {
  return page.evaluate(async (limit) => {
    const w = window as MeasureWindow;
    if (!w.__t1) throw new Error('No watch was armed before awaiting it.');
    const result = await Promise.race([
      w.__t1,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), limit)),
    ]);
    // On a timeout the observer would otherwise stay attached for the rest of the session.
    w.__stopWatch?.();
    return result;
  }, timeoutMs);
}

/** Current text of the participation cell. */
export async function readParticipation(page: Page, rowTestId: string): Promise<string> {
  return page.evaluate(
    ({ id, column }) =>
      (
        document.querySelector(`[data-testid="${id}"]`)?.querySelectorAll('td')[column]
          ?.textContent ?? ''
      ).trim(),
    { id: rowTestId, column: PARTICIPATION_COLUMN },
  );
}
