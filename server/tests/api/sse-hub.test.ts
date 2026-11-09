import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import type { Snapshot } from '@staffing/shared';
import { pino } from 'pino';
import { describe, expect, it, vi } from 'vitest';
import { createHub } from '../../src/sse.js';

/** A response that behaves like a real one in the way that matters here: writing after end throws. */
function fakeResponse() {
  let ended = false;
  const res = {
    locals: {},
    status: vi.fn(() => res),
    set: vi.fn(() => res),
    json: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn(() => {
      if (ended) throw new Error('write after end');
      return true;
    }),
    end: vi.fn(() => {
      ended = true;
    }),
  };
  return res;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

describe('live hub while a snapshot is still loading', () => {
  const logger = pino({ level: 'silent' });
  const snapshot = { version: 1 } as Snapshot;

  function setup() {
    const loading = deferred<Snapshot>();
    const hub = createHub({ maxClients: 5, pingMs: 60_000, loadSnapshot: () => loading.promise, logger });
    return { hub, loading };
  }

  it('does not write to a client that left before the snapshot was ready', async () => {
    const { hub, loading } = setup();
    const req = new EventEmitter();
    const res = fakeResponse();

    const connecting = hub.connect(req as unknown as Request, res as unknown as Response);
    req.emit('close');
    loading.resolve(snapshot);
    await connecting;

    expect(res.write).not.toHaveBeenCalledWith(expect.stringContaining('event: snapshot'));
    hub.stop();
  });

  it('does not write to a client the hub ended meanwhile (shutdown or outage)', async () => {
    const { hub, loading } = setup();
    const res = fakeResponse();

    const connecting = hub.connect(new EventEmitter() as unknown as Request, res as unknown as Response);
    hub.stop();
    loading.resolve(snapshot);

    await expect(connecting).resolves.toBeUndefined();
    expect(res.write).not.toHaveBeenCalledWith(expect.stringContaining('event: snapshot'));
  });

  it('still delivers the snapshot to a client that stays connected', async () => {
    const { hub, loading } = setup();
    const res = fakeResponse();

    const connecting = hub.connect(new EventEmitter() as unknown as Request, res as unknown as Response);
    loading.resolve(snapshot);
    await connecting;

    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('event: snapshot'));
    hub.stop();
  });
});
