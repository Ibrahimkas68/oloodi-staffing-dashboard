import { Router } from 'express';
import type { StaffingService } from '../service.js';

export function healthRoutes(service: StaffingService): Router {
  const router = Router();

  router.get('/health', async (_req, res) => {
    const dbUp = await service.checkHealth();
    res.status(dbUp ? 200 : 503).json({ status: dbUp ? 'ok' : 'degraded', db: dbUp ? 'ok' : 'down' });
  });

  return router;
}
