import type { Snapshot } from '@staffing/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The live store keeps module-level state and talks to `window` and `EventSource`, so each test
 * loads a fresh copy of it with fake versions of both and fake timers.
 */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  readyState = FakeEventSource.CONNECTING;
  onerror: (() => void) | null = null;
  private handlers = new Map<string, Array<(event: { data: string }) => void>>();

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, handler: (event: { data: string }) => void) {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
  }
  close() {
    this.readyState = FakeEventSource.CLOSED;
  }
  emit(type: string, data = '') {
    this.handlers.get(type)?.forEach((handler) => handler({ data }));
  }
  /** A connection error. `closed`: the browser gave up (for example after a 503). */
  fail(closed: boolean) {
    this.readyState = closed ? FakeEventSource.CLOSED : FakeEventSource.CONNECTING;
    this.onerror?.();
  }
}

function snapshotJson(version: number): string {
  const snapshot: Snapshot = {
    version,
    serverTime: new Date().toISOString(),
    demoMode: false,
    shift: {
      id: 1,
      title: 'Shift',
      location: 'Hall',
      startsAt: '2026-11-09T10:00:00.000Z',
      endsAt: '2026-11-09T16:00:00.000Z',
      requiredWorkers: 3,
    },
    assignments: [],
    counts: { filled: 0, remaining: 3, checkedIn: 0, checkedOut: 0, invited: 0, declined: 0, cancelled: 0, uninvited: 0 },
    recentEvents: [],
  };
  return JSON.stringify(snapshot);
}

let live: typeof import('../src/lib/live.js');
let win: EventTarget;
const latest = () => FakeEventSource.instances[FakeEventSource.instances.length - 1]!;
const status = () => live.getLiveState().status;

beforeEach(async () => {
  vi.useFakeTimers();
  FakeEventSource.instances = [];
  win = new EventTarget();
  vi.stubGlobal('window', win);
  vi.stubGlobal('EventSource', FakeEventSource);
  vi.resetModules();
  live = await import('../src/lib/live.js');
  live.startLive();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('live connection', () => {
  it('becomes Live on the first valid snapshot, not on a ping alone', () => {
    latest().emit('ping');
    expect(status()).toBe('connecting');
    latest().emit('snapshot', snapshotJson(1));
    expect(status()).toBe('live');
  });

  it('ignores a snapshot that is not valid', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    latest().emit('snapshot', '{"nope":true}');
    expect(status()).toBe('connecting');
    expect(live.getLiveState().snapshot).toBeNull();
  });
});

describe('the browser goes offline', () => {
  beforeEach(() => {
    latest().emit('snapshot', snapshotJson(1));
  });

  it('shows Offline at once and closes the stream', () => {
    const stream = latest();
    win.dispatchEvent(new Event('offline'));
    expect(status()).toBe('offline');
    expect(stream.readyState).toBe(FakeEventSource.CLOSED);
  });

  it('keeps probing without waiting for an online event, and stays Offline until data arrives', () => {
    win.dispatchEvent(new Event('offline'));
    expect(FakeEventSource.instances).toHaveLength(1);

    vi.advanceTimersByTime(live.OFFLINE_PROBE_MS);
    expect(FakeEventSource.instances).toHaveLength(2);

    // A failed probe must not flip the badge to Reconnecting.
    latest().fail(false);
    expect(status()).toBe('offline');
    latest().fail(true);
    expect(status()).toBe('offline');

    // The probe loop continues after the backoff.
    vi.advanceTimersByTime(60_000);
    expect(FakeEventSource.instances.length).toBeGreaterThan(2);
    expect(status()).toBe('offline');
  });

  it('recovers by itself when a probe gets through, even if the online event never fires', () => {
    win.dispatchEvent(new Event('offline'));
    vi.advanceTimersByTime(live.OFFLINE_PROBE_MS);
    latest().emit('snapshot', snapshotJson(2));
    expect(status()).toBe('live');
    expect(live.getLiveState().snapshot?.version).toBe(2);
  });

  it('reconnects at once on the online event and shows Reconnecting until data arrives', () => {
    win.dispatchEvent(new Event('offline'));
    win.dispatchEvent(new Event('online'));
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(status()).toBe('reconnecting');

    latest().emit('snapshot', snapshotJson(2));
    expect(status()).toBe('live');
  });

  it('after online, a failing connection no longer counts as offline until it fails again', () => {
    win.dispatchEvent(new Event('offline'));
    win.dispatchEvent(new Event('online'));
    latest().fail(false);
    expect(status()).toBe('reconnecting');
  });
});
