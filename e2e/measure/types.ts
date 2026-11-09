/** What the worker presses: Amina's participation toggles between accepted and cancelled. */
export type ToggleAction = 'cancel' | 'accept';

export type Sample = {
  /** Position in the loop, warm-up runs first. */
  index: number;
  warmup: boolean;
  action: ToggleAction;
  /** The manager never showed the expected state in time. Failed runs are kept, never dropped. */
  failed: boolean;
  /** Update delay or recovery time in milliseconds; null for a failed run. */
  ms: number | null;
};

/** Which route brought the manager back: the browser's `online` event, or something slower. */
export type RecoveryPath = 'online-event' | 'no-online-event';

export type RecoverySample = Sample & {
  /** Time from restoring the network to the page's `online` event; null if it never fired. */
  onlineEventMs: number | null;
  path: RecoveryPath;
};

export type RunMode = 'local-host' | 'container';
