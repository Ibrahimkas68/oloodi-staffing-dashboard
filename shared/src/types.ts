import type { z } from 'zod';
import type {
  actionResultSchema,
  actionSchema,
  actorSchema,
  apiErrorSchema,
  assignmentSchema,
  assignmentStateSchema,
  attendanceSchema,
  countsSchema,
  errorCodeSchema,
  eventSchema,
  participationSchema,
  snapshotSchema,
} from './schemas.js';

export type Participation = z.infer<typeof participationSchema>;
export type Attendance = z.infer<typeof attendanceSchema>;
export type Action = z.infer<typeof actionSchema>;
export type Actor = z.infer<typeof actorSchema>;
export type ErrorCode = z.infer<typeof errorCodeSchema>;
export type AssignmentState = z.infer<typeof assignmentStateSchema>;
export type Assignment = z.infer<typeof assignmentSchema>;
export type Counts = z.infer<typeof countsSchema>;
export type ActivityEvent = z.infer<typeof eventSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type ActionResult = z.infer<typeof actionResultSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
