import type { Page } from '@playwright/test';
import type { ToggleAction } from './types.js';

/**
 * Amina's participation toggles between accepted and cancelled. After a cancel the worker's button
 * reads "Accept again" (see actionLabel in web/src/lib/workerView.ts), not "Accept".
 */
const TOGGLES: Record<
  ToggleAction,
  { buttonName: string; managerText: string; next: ToggleAction }
> = {
  cancel: { buttonName: 'Cancel my spot', managerText: 'Cancelled', next: 'accept' },
  accept: { buttonName: 'Accept again', managerText: 'Accepted', next: 'cancel' },
};

/** The text the manager's participation cell shows once the action has been applied. */
export const expectedManagerText = (action: ToggleAction): string => TOGGLES[action].managerText;

/** The action to take when the manager currently shows this text: undo the state it shows. */
export function actionFrom(managerText: string): ToggleAction {
  const action = (Object.keys(TOGGLES) as ToggleAction[]).find(
    (candidate) => TOGGLES[TOGGLES[candidate].next].managerText === managerText,
  );
  if (!action)
    throw new Error(
      `Expected the manager to show Accepted or Cancelled, but it shows "${managerText}".`,
    );
  return action;
}

const workerButton = (worker: Page, action: ToggleAction) =>
  worker.getByRole('button', { name: TOGGLES[action].buttonName, exact: true });

/** Presses the worker's button for this action. */
export async function clickAction(worker: Page, action: ToggleAction): Promise<void> {
  await workerButton(worker, action).click();
}

/** Waits until the worker has the button for the next toggle, which means the action is done there. */
export async function waitForNextButton(worker: Page, action: ToggleAction): Promise<void> {
  await workerButton(worker, TOGGLES[action].next).waitFor({ state: 'visible' });
}

/** The button the worker has before this action; used to wait for the starting state. */
export const waitForButton = (worker: Page, action: ToggleAction) =>
  workerButton(worker, action).waitFor({ state: 'visible' });
