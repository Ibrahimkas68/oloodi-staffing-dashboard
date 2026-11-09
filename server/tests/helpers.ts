import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Snapshot } from '@staffing/shared';
import { pino } from 'pino';
import { afterAll, beforeEach } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createPool } from '../src/db/pool.js';
import { resetDatabase } from '../src/db/reset.js';
import { createService } from '../src/service.js';
import { createHub } from '../src/sse.js';

/** Builds a full app against the test database and resets it before each test. */
export function setupTestApp() {
  const config = loadConfig();
  const logger = pino({ level: 'silent' });
  const db = createPool(config.DATABASE_URL);
  const service = createService(db, { demoMode: config.DEMO_MODE });
  const hub = createHub({ maxClients: 5, pingMs: config.SSE_PING_MS, loadSnapshot: service.getSnapshot, logger });
  const app = createApp({ service, hub, logger, rateLimitPerMinute: config.RATE_LIMIT_PER_MINUTE });

  beforeEach(async () => {
    await resetDatabase(config.DATABASE_OWNER_URL!, config.APP_DB_PASSWORD!);
  });

  afterAll(async () => {
    hub.stop();
    await db.end();
  });

  return { app, db, service, hub };
}

/** Opens a real SSE connection and collects `snapshot` events. */
export async function openStream(app: http.RequestListener) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;

  const snapshots: Snapshot[] = [];
  const waiters: Array<() => void> = [];
  let buffer = '';

  const req = http.get({ port, path: '/api/events' }, (res) => {
    res.setEncoding('utf8');
    res.on('data', (chunk: string) => {
      buffer += chunk;
      let index;
      while ((index = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        const event = /^event: (.+)$/m.exec(block)?.[1];
        const data = /^data: (.+)$/m.exec(block)?.[1];
        if (event === 'snapshot' && data) {
          snapshots.push(JSON.parse(data) as Snapshot);
          waiters.splice(0).forEach((wake) => wake());
        }
      }
    });
  });
  // Keep a real connection error so waitFor can report it; close() destroys the request on
  // purpose, and that error is expected.
  let streamError: Error | undefined;
  let closing = false;
  req.on('error', (error) => {
    if (!closing) streamError = error;
  });

  return {
    snapshots,
    /** Resolves once at least `count` snapshots have arrived (fails after 3 s). */
    async waitFor(count: number): Promise<Snapshot[]> {
      const deadline = Date.now() + 3_000;
      while (snapshots.length < count) {
        if (streamError) throw streamError;
        if (Date.now() > deadline) throw new Error(`Expected ${count} snapshots, got ${snapshots.length}`);
        await new Promise<void>((resolve) => {
          waiters.push(resolve);
          setTimeout(resolve, 100);
        });
      }
      return snapshots;
    },
    async close() {
      closing = true;
      req.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
