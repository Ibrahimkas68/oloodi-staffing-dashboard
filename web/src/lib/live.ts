import { useSyncExternalStore } from 'react';
import { snapshotSchema, type Snapshot } from '@staffing/shared';

export type LiveStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

export type LiveState = {
  status: LiveStatus;
  snapshot: Snapshot | null;
  /** Last time anything (snapshot or ping) arrived from the server. */
  lastSyncedAt: number | null;
  /** Time spent reconnecting before the last successful catch-up, for the metrics panel. */
  lastRecoveryMs: number | null;
};

export const WATCHDOG_MS = 35_000;
/** After this many consecutive errors the badge says Offline instead of Reconnecting. */
const OFFLINE_AFTER_ERRORS = 3;

/** Only a strictly newer version may replace what we hold. */
export function shouldApply(current: Snapshot | null, incoming: Snapshot): boolean {
  return current === null || incoming.version > current.version;
}

/** Manual reconnect delays after a closed stream: 1 s, 2 s, 4 s, then 10 s max. */
export function backoffDelay(attempt: number): number {
  return Math.min(1_000 * 2 ** attempt, 10_000);
}

let state: LiveState = { status: 'connecting', snapshot: null, lastSyncedAt: null, lastRecoveryMs: null };
const listeners = new Set<() => void>();

function setState(patch: Partial<LiveState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

/** Applies a snapshot from the stream or from an HTTP response, through the same version guard. */
export function applySnapshot(incoming: Snapshot): void {
  if (shouldApply(state.snapshot, incoming)) setState({ snapshot: incoming });
}

let source: EventSource | null = null;
let watchdog: ReturnType<typeof setTimeout> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let attempt = 0;
let errorCount = 0;
let disconnectedAt: number | null = null;

function touch() {
  clearTimeout(watchdog);
  // A connection that stays silent longer than two heartbeats is treated as dead.
  watchdog = setTimeout(restart, WATCHDOG_MS);
  if (state.status !== 'live') {
    const recovery = disconnectedAt === null ? state.lastRecoveryMs : Date.now() - disconnectedAt;
    disconnectedAt = null;
    setState({ status: 'live', lastSyncedAt: Date.now(), lastRecoveryMs: recovery });
  } else {
    setState({ lastSyncedAt: Date.now() });
  }
  attempt = 0;
  errorCount = 0;
}

function markDisconnected(status: LiveStatus) {
  disconnectedAt ??= Date.now();
  if (state.status !== status) setState({ status });
}

function open() {
  clearTimeout(retryTimer);
  source?.close();
  const es = new EventSource('/api/events');
  source = es;

  es.addEventListener('snapshot', (event) => {
    const parsed = snapshotSchema.safeParse(JSON.parse((event as MessageEvent<string>).data));
    if (parsed.success) applySnapshot(parsed.data);
    touch();
  });
  es.addEventListener('ping', touch);

  es.onerror = () => {
    errorCount += 1;
    if (es.readyState === EventSource.CLOSED) {
      // The browser gave up (for example the server answered 503): reconnect ourselves.
      markDisconnected('offline');
      scheduleReconnect();
    } else {
      markDisconnected(errorCount >= OFFLINE_AFTER_ERRORS ? 'offline' : 'reconnecting');
    }
  };
}

function scheduleReconnect() {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(open, backoffDelay(attempt));
  attempt += 1;
}

function restart() {
  source?.close();
  markDisconnected('reconnecting');
  open();
}

let started = false;
function start() {
  if (started) return;
  started = true;
  open();
  // Coming back online: do not wait for the next backoff step.
  window.addEventListener('online', () => {
    if (state.status !== 'live') restart();
  });
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Live snapshot, connection status and last sync time, shared by every component. */
export function useLive(): LiveState {
  return useSyncExternalStore(subscribe, () => state);
}
