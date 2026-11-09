import type { Request, Response } from 'express';
import type { Snapshot } from '@staffing/shared';
import type { Logger } from 'pino';

export type LiveHub = ReturnType<typeof createHub>;

type Options = {
  maxClients: number;
  pingMs: number;
  loadSnapshot: () => Promise<Snapshot>;
  logger: Logger;
};

/**
 * Server-Sent Events hub. Each client gets a full snapshot on connect and after every change.
 * Clients keep only the newest version, so order and duplicates do not matter.
 */
export function createHub({ maxClients, pingMs, loadSnapshot, logger }: Options) {
  const clients = new Set<Response>();
  let unavailableUntil = 0;

  const write = (res: Response, event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Named event, not an SSE comment: comments are invisible to EventSource and the client
  // watchdog needs to see that the connection is alive.
  const pingTimer = setInterval(() => {
    for (const res of clients) write(res, 'ping', { serverTime: new Date().toISOString() });
  }, pingMs);
  pingTimer.unref();

  async function connect(req: Request, res: Response): Promise<void> {
    if (Date.now() < unavailableUntil || clients.size >= maxClients) {
      res.status(503).json({
        error: { code: 'UNAVAILABLE', message: 'Live updates are temporarily unavailable.' },
        requestId: String(res.locals.requestId ?? ''),
      });
      return;
    }

    res.status(200).set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    res.write('retry: 2000\n\n');

    // Register before reading the snapshot: a change committed in between is still delivered.
    clients.add(res);
    req.on('close', () => clients.delete(res));

    try {
      const snapshot = await loadSnapshot();
      // The client may have left, or the hub may have stopped, while the snapshot was loading.
      // Writing to an ended response would raise an unhandled error.
      if (!clients.has(res)) return;
      write(res, 'snapshot', snapshot);
    } catch (err) {
      logger.error({ err }, 'could not load the initial snapshot');
      clients.delete(res);
      res.end();
    }
  }

  function broadcast(snapshot: Snapshot): void {
    for (const res of clients) write(res, 'snapshot', snapshot);
  }

  /** Drops every connection and refuses new ones for `ms` (demo outage). */
  function simulateOutage(ms: number): void {
    unavailableUntil = Date.now() + ms;
    closeAll();
  }

  function closeAll(): void {
    for (const res of clients) res.end();
    clients.clear();
  }

  function stop(): void {
    clearInterval(pingTimer);
    closeAll();
  }

  return { connect, broadcast, simulateOutage, closeAll, stop, size: () => clients.size };
}
