import { Router } from 'express';
import { DomainError } from '../errors.js';
import { actionByPath, idSchema } from './params.js';
import type { StaffingService } from '../service.js';
import type { LiveHub } from '../sse.js';

export function assignmentRoutes(service: StaffingService, hub: LiveHub): Router {
  const router = Router();

  router.post('/assignments/:id/:action', async (req, res) => {
    const action = actionByPath.get(req.params.action);
    if (!action) throw new DomainError('NOT_FOUND', `Unknown action "${req.params.action}".`);

    const id = idSchema.safeParse(req.params.id);
    if (!id.success) {
      throw new DomainError('VALIDATION_ERROR', 'The assignment id must be a positive whole number.');
    }

    const result = await service.runAction(id.data, action);
    if (result.changed) hub.broadcast(result.snapshot);
    res.json(result);
  });

  return router;
}
