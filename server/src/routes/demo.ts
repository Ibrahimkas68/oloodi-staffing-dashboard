import { Router } from 'express';
import { ACTION_PATHS, type Action } from '@staffing/shared';
import { z } from 'zod';
import { DomainError } from '../errors.js';
import type { StaffingService } from '../service.js';
import type { LiveHub } from '../sse.js';
import { actionByPath, idSchema } from './params.js';

/** The pool holds 10 connections, so a burst of this size never waits for a free one. */
export const BURST_SIZE = 10;
export const MIN_OUTAGE_SECONDS = 1;
export const MAX_OUTAGE_SECONDS = 30;

const burstQuerySchema = z.object({
  assignmentId: idSchema,
  action: z
    .string()
    .default(ACTION_PATHS.check_in)
    .transform((path) => actionByPath.get(path))
    .refine((action): action is Action => action !== undefined),
});

const outageQuerySchema = z.object({
  seconds: z
    .string()
    .regex(/^\d{1,2}$/)
    .transform(Number)
    .refine((n) => n >= MIN_OUTAGE_SECONDS && n <= MAX_OUTAGE_SECONDS),
});

function parseQuery<T extends z.ZodType>(schema: T, query: unknown, message: string): z.output<T> {
  const parsed = schema.safeParse(query);
  if (!parsed.success) throw new DomainError('VALIDATION_ERROR', message);
  return parsed.data;
}

/**
 * Demo controls, mounted only when DEMO_MODE is on.
 * The burst calls the service directly (not over HTTP), so the actions rate limiter never sees it.
 */
export function demoRoutes(service: StaffingService, hub: LiveHub): Router {
  const router = Router();

  router.post('/demo/burst', async (req, res) => {
    const { assignmentId, action } = parseQuery(
      burstQuerySchema,
      req.query,
      'Give assignmentId (a positive whole number) and, optionally, a known action such as check-in.',
    );

    const results = await Promise.all(
      Array.from({ length: BURST_SIZE }, () => service.runAction(assignmentId, action)),
    );
    // The row lock lets exactly one of them change anything; the others see the finished state.
    const changedResult = results.find((result) => result.changed);
    if (changedResult) hub.broadcast(changedResult.snapshot);

    res.json({ sent: BURST_SIZE, changed: results.filter((result) => result.changed).length });
  });

  router.post('/demo/outage', (req, res) => {
    const { seconds } = parseQuery(
      outageQuerySchema,
      req.query,
      `seconds must be a whole number from ${MIN_OUTAGE_SECONDS} to ${MAX_OUTAGE_SECONDS}.`,
    );

    // The hub compares timestamps, so recovery needs no timer to clean up on shutdown.
    hub.simulateOutage(seconds * 1000);
    res.status(202).json({ seconds });
  });

  return router;
}
