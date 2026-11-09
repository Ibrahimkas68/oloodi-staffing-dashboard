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
  /**
   * Version of the newest snapshot that came from another session: it arrived on the stream while
   * this tab had no request of its own in flight. The worker view uses it to say "Updated from
   * another session".
   */
  remoteVersion: number | null;
};

export const WATCHDOG_MS = 35_000;
/** After this many consecutive errors the badge says Offline instead of Reconnecting. */
const OFFLINE_AFTER_ERRORS = 3;

/**
 * Only a strictly newer version may replace what we hold.
 *
 * One exception: the first snapshot of a new connection may carry a lower version after a database
 * reset (the version restarts at 0). It is accepted when it was built no earlier than the snapshot
 * we hold, so a reset is picked up without a reload, while an older snapshot that raced a commit
 * is still ignored.
 */
export function shouldApply(current: Snapshot | null, incoming: Snapshot, firstOfConnection = false): boolean {
  if (current === null || incoming.version > current.version) return true;
  return firstOfConnection && incoming.serverTime >= current.serverTime;
}

/** Manual reconnect delays after a closed stream: 1 s, 2 s, 4 s, then 10 s max. */
export function backoffDelay(attempt: number): number {
  return Math.min(1_000 * 2 ** attempt, 10_000);
}

let state: LiveState = { status: 'connecting', snapshot: null, lastSyncedAt: null, lastRecoveryMs: null, remoteVersion: null };
const listeners = new Set<() => void>();

function setState(patch: Partial<LiveState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

/** Requests this tab has sent and not yet answered. */
let localRequests = 0;

/**
 * Marks a request as this tab's own while it runs. The server broadcasts the result on the stream
 * as well, and that echo can beat the HTTP response, so a stream snapshot that lands meanwhile is
 * not reported as coming from another session. A change made elsewhere while a request is open
 * (normally well under a second, up to the retry budget of about 25 s on a bad network) goes
 * unannounced, and a request that failed after the server saved it can be announced by the
 * catch-up snapshot after a reconnect. Both are rare and harmless: the screen is correct either
 * way, only the notice may be missing or extra.
 */
export async function trackLocalRequest<T>(request: Promise<T>): Promise<T> {
  localRequests += 1;
  try {
    return await request;
  } finally {
    localRequests -= 1;
  }
}

function commit(incoming: Snapshot, firstOfConnection: boolean, fromAnotherSession: boolean): void {
  if (!shouldApply(state.snapshot, incoming, firstOfConnection)) return;
  setState({ snapshot: incoming, remoteVersion: fromAnotherSession ? incoming.version : state.remoteVersion });
}

/** Applies a snapshot from the stream, through the version guard. */
export function applySnapshot(incoming: Snapshot, firstOfConnection = false): void {
  // The very first snapshot is simply the initial load, not a change.
  commit(incoming, firstOfConnection, state.snapshot !== null && localRequests === 0);
}

/** Applies the snapshot that came back in the response to this tab's own request. */
export function applyOwnSnapshot(incoming: Snapshot): void {
  commit(incoming, false, false);
}

/** Reads a snapshot event body. A bad payload is logged and dropped, never thrown. */
function parseSnapshot(data: string): Snapshot | null {
  try {
    const parsed = snapshotSchema.safeParse(JSON.parse(data));
    if (parsed.success) return parsed.data;
    console.warn('Ignored a snapshot that does not match the schema', parsed.error.issues);
  } catch {
    console.warn('Ignored a snapshot that is not valid JSON');
  }
  return null;
}

/**
 * After the browser reports `offline`, how long to wait between quiet reconnect attempts. The
 * `offline` event is only a hint (VPN switches, captive portals and sleep/wake can report it while
 * the network works, or miss the matching `online`), so the client keeps probing instead of waiting
 * for an event that may never come.
 */
export const OFFLINE_PROBE_MS = 10_000;

let source: EventSource | null = null;
let watchdog: ReturnType<typeof setTimeout> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let attempt = 0;
let errorCount = 0;
let disconnectedAt: number | null = null;
/** True from an `offline` event until a valid snapshot arrives or `online` fires. */
let holdOffline = false;

function armWatchdog() {
  clearTimeout(watchdog);
  // A connection that stays silent longer than two heartbeats is treated as dead.
  watchdog = setTimeout(restart, WATCHDOG_MS);
}

function touch() {
  armWatchdog();
  holdOffline = false;
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
  // While the browser says it is offline the badge stays Offline, even though quiet probes run.
  const shown = holdOffline ? 'offline' : status;
  if (state.status !== shown) setState({ status: shown });
}

function open() {
  clearTimeout(retryTimer);
  source?.close();
  const es = new EventSource('/api/events');
  source = es;
  // A connection that never sends anything is retried too, not only one that goes quiet later.
  armWatchdog();

  let firstSnapshot = true;
  es.addEventListener('snapshot', (event) => {
    const incoming = parseSnapshot((event as MessageEvent<string>).data);
    if (!incoming) return;
    applySnapshot(incoming, firstSnapshot);
    firstSnapshot = false;
    touch();
  });
  // A ping proves the connection is alive, but the status only becomes Live once real data
  // (a valid snapshot) has arrived on this connection.
  es.addEventListener('ping', () => (firstSnapshot ? armWatchdog() : touch()));

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

/** Losing the network: show Offline at once, then keep probing slowly in case the hint was wrong. */
function goOffline() {
  holdOffline = true;
  clearTimeout(watchdog);
  clearTimeout(retryTimer);
  source?.close();
  markDisconnected('offline');
  // open() re-arms the watchdog, and a failed probe goes through the normal backoff, so the loop
  // continues until a snapshot arrives (which clears the hold).
  retryTimer = setTimeout(open, OFFLINE_PROBE_MS);
}

/** Coming back online: reconnect now instead of waiting for the next probe or backoff step. */
function comeOnline() {
  holdOffline = false;
  attempt = 0;
  errorCount = 0;
  if (state.status !== 'live') restart();
}

let started = false;

/** Opens the live connection (once). Called by the first component that subscribes. */
export function startLive(): void {
  if (started) return;
  started = true;
  open();
  window.addEventListener('online', comeOnline);
  window.addEventListener('offline', goOffline);
}

function subscribe(listener: () => void) {
  startLive();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The current live state without subscribing to it (for code outside React, and tests). */
export function getLiveState(): LiveState {
  return state;
}

/** Live snapshot, connection status and last sync time, shared by every component. */
export function useLive(): LiveState {
  return useSyncExternalStore(subscribe, () => state);
}
