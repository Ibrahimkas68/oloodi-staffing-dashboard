import { Router } from 'express';
import { ACTION_PATHS, type Action } from '@staffing/shared';
import { z } from 'zod';
import { DomainError } from '../errors.js';
import type { StaffingService } from '../service.js';
import type { LiveHub } from '../sse.js';

// Positive integer that fits a Postgres integer. Rejects "abc", "-1", "1.5", " 1", "1; DROP ...".
const idSchema = z
  .string()
  .regex(/^[1-9]\d{0,9}$/)
  .transform(Number)
  .refine((n) => n <= 2_147_483_647);

const actionByPath = new Map<string, Action>(
  (Object.entries(ACTION_PATHS) as [Action, string][]).map(([action, path]) => [path, action]),
);

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
