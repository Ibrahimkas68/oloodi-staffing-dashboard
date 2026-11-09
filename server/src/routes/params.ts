import { ACTION_PATHS, type Action } from '@staffing/shared';
import { z } from 'zod';

// Positive integer that fits a Postgres integer. Rejects "abc", "-1", "1.5", " 1", "1; DROP ...".
export const idSchema = z
  .string()
  .regex(/^[1-9]\d{0,9}$/)
  .transform(Number)
  .refine((n) => n <= 2_147_483_647);

/** Maps a URL segment such as `check-in` to its action. */
export const actionByPath = new Map<string, Action>(
  (Object.entries(ACTION_PATHS) as [Action, string][]).map(([action, path]) => [path, action]),
);
