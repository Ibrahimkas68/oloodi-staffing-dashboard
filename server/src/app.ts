import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import express, { type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import { DomainError, errorHandler, notFoundHandler, sendError } from './errors.js';
import { assignmentRoutes } from './routes/assignments.js';
import { healthRoutes } from './routes/health.js';
import { stateRoutes } from './routes/state.js';
import type { StaffingService } from './service.js';
import type { LiveHub } from './sse.js';

type AppOptions = {
  service: StaffingService;
  hub: LiveHub;
  logger: Logger;
  rateLimitPerMinute: number;
  /** Folder with the built web app, served in production. */
  webDist?: string;
};

const REQUEST_ID = /^[\w-]{1,100}$/;

/** Reuse a sane X-Request-Id from the client or generate one, and echo it back. */
const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.get('X-Request-Id');
  const id = incoming && REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.locals.requestId = id;
  res.set('X-Request-Id', id);
  next();
};

const noStore: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};

export function createApp({ service, hub, logger, rateLimitPerMinute, webDist }: AppOptions) {
  const app = express();
  app.disable('x-powered-by');

  // 1. request id, 2. logs
  app.use(requestId);
  app.use(pinoHttp({ logger, genReqId: (_req, res) => String(res.locals.requestId) }));
  // 3. security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: { defaultSrc: ["'self'"], connectSrc: ["'self'"], imgSrc: ["'self'", 'data:'] },
      },
    }),
  );
  // 4. rate limit on actions only (reads and the live stream are not limited)
  const limiter = rateLimit({
    windowMs: 60_000,
    limit: rateLimitPerMinute,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) =>
      sendError(res, new DomainError('RATE_LIMITED', 'Too many actions. Wait a moment and try again.')),
  });
  app.post('/api/{*path}', limiter);
  // 5. body limit, 6. no caching on the API
  app.use(express.json({ limit: '10kb' }));
  app.use('/api', noStore);

  // 7. routes
  app.use('/api', healthRoutes(service));
  app.use('/api', stateRoutes(service, hub));
  app.use('/api', assignmentRoutes(service, hub));
  app.use('/api', notFoundHandler);

  if (webDist && existsSync(webDist)) {
    app.use(express.static(webDist));
    // Single-page app: unknown non-API paths return index.html (/, /worker, ...).
    app.get('/{*path}', (_req, res) => res.sendFile('index.html', { root: webDist }));
  }

  // 8. 404, 9. errors
  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return app;
}
