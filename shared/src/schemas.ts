import { z } from 'zod';

export const PARTICIPATIONS = ['uninvited', 'invited', 'accepted', 'declined', 'cancelled'] as const;
export const ATTENDANCES = ['not_started', 'checked_in', 'checked_out'] as const;
export const ACTIONS = ['invite', 'accept', 'decline', 'cancel', 'check_in', 'check_out'] as const;
export const ACTORS = ['manager', 'worker'] as const;
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'INVALID_TRANSITION',
  'SHIFT_FULL',
  'RATE_LIMITED',
  'UNAVAILABLE',
  'INTERNAL',
] as const;

export const participationSchema = z.enum(PARTICIPATIONS);
export const attendanceSchema = z.enum(ATTENDANCES);
export const actionSchema = z.enum(ACTIONS);
export const actorSchema = z.enum(ACTORS);
export const errorCodeSchema = z.enum(ERROR_CODES);

/** URL segment for each action, e.g. POST /api/assignments/1/check-in. */
export const ACTION_PATHS = {
  invite: 'invite',
  accept: 'accept',
  decline: 'decline',
  cancel: 'cancel',
  check_in: 'check-in',
  check_out: 'check-out',
} as const satisfies Record<(typeof ACTIONS)[number], string>;

const isoTime = z.string().datetime({ offset: true });

export const assignmentStateSchema = z.object({
  participation: participationSchema,
  attendance: attendanceSchema,
});

export const assignmentSchema = z.object({
  id: z.number().int().positive(),
  worker: z.object({ id: z.number().int().positive(), fullName: z.string() }),
  participation: participationSchema,
  attendance: attendanceSchema,
  invitedAt: isoTime.nullable(),
  respondedAt: isoTime.nullable(),
  cancelledAt: isoTime.nullable(),
  checkedInAt: isoTime.nullable(),
  checkedOutAt: isoTime.nullable(),
});

export const countsSchema = z.object({
  filled: z.number().int(),
  remaining: z.number().int(),
  checkedIn: z.number().int(),
  checkedOut: z.number().int(),
  invited: z.number().int(),
  declined: z.number().int(),
  cancelled: z.number().int(),
  uninvited: z.number().int(),
});

export const eventSchema = z.object({
  id: z.number().int().positive(),
  action: actionSchema,
  actor: actorSchema,
  assignmentId: z.number().int().positive(),
  workerName: z.string(),
  at: isoTime,
  version: z.number().int().positive(),
});

export const snapshotSchema = z.object({
  version: z.number().int().nonnegative(),
  serverTime: isoTime,
  demoMode: z.boolean(),
  shift: z.object({
    id: z.number().int().positive(),
    title: z.string(),
    location: z.string(),
    startsAt: isoTime,
    endsAt: isoTime,
    requiredWorkers: z.number().int().positive(),
  }),
  assignments: z.array(assignmentSchema),
  counts: countsSchema,
  recentEvents: z.array(eventSchema),
});

export const actionResultSchema = z.object({
  changed: z.boolean(),
  snapshot: snapshotSchema,
});

export const apiErrorSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    current: assignmentStateSchema.optional(),
    filled: z.number().int().optional(),
    required: z.number().int().optional(),
  }),
  requestId: z.string(),
});
