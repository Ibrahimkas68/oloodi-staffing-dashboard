import { Router } from 'express';
import type { StaffingService } from '../service.js';
import type { LiveHub } from '../sse.js';

export function stateRoutes(service: StaffingService, hub: LiveHub): Router {
  const router = Router();

  router.get('/state', async (_req, res) => {
    res.json(await service.getSnapshot());
  });

  router.get('/events', (req, res) => hub.connect(req, res));

  return router;
}
