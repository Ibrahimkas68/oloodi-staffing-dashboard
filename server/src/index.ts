import { fileURLToPath } from 'node:url';
import { pino } from 'pino';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createPool } from './db/pool.js';
import { isDatabaseEmpty, resetDatabase } from './db/reset.js';
import { createService } from './service.js';
import { createHub } from './sse.js';

const config = loadConfig();
const logger = pino({ level: config.LOG_LEVEL });

// First start in Docker: create schema, roles and seed if the database is empty.
if (config.DATABASE_OWNER_URL && config.APP_DB_PASSWORD) {
  if (await isDatabaseEmpty(config.DATABASE_OWNER_URL)) {
    await resetDatabase(config.DATABASE_OWNER_URL, config.APP_DB_PASSWORD);
    logger.info('empty database: schema, roles and seed applied');
  }
}

const db = createPool(config.DATABASE_URL);
const service = createService(db, { demoMode: config.DEMO_MODE });
const hub = createHub({
  maxClients: config.SSE_MAX_CLIENTS,
  pingMs: config.SSE_PING_MS,
  loadSnapshot: service.getSnapshot,
  logger,
});
const app = createApp({
  service,
  hub,
  logger,
  rateLimitPerMinute: config.RATE_LIMIT_PER_MINUTE,
  webDist: fileURLToPath(new URL('../../web/dist', import.meta.url)),
});

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, demoMode: config.DEMO_MODE }, 'server listening');
});

// Graceful shutdown: stop accepting, close live streams, finish requests, drain the pool.
let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');
  hub.stop();
  server.close(async () => {
    await db.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
