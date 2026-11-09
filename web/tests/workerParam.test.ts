import type { Assignment, Snapshot } from '@staffing/shared';
import { describe, expect, it } from 'vitest';
import { findAssignmentForWorker, parseWorkerParam } from '../src/lib/workerParam.js';

describe('parseWorkerParam', () => {
  it('reads a valid worker id', () => {
    expect(parseWorkerParam('?worker=2')).toBe(2);
    expect(parseWorkerParam('?other=x&worker=123456789&more=y')).toBe(123456789);
  });

  it.each(['?worker=abc', '?worker=0', '?worker=-1', '?worker=1.5', '?worker=01', '?worker=', '?worker=1e3', '?worker=%201'])(
    'rejects %s',
    (search) => {
      expect(parseWorkerParam(search)).toBeNull();
    },
  );

  it('rejects a number too large to be an id', () => {
    expect(parseWorkerParam('?worker=99999999999999999999')).toBeNull();
    expect(parseWorkerParam('?worker=1234567890')).toBeNull();
  });

  it('returns null when the parameter is missing', () => {
    expect(parseWorkerParam('')).toBeNull();
    expect(parseWorkerParam('?other=1')).toBeNull();
  });

  it('uses the first value of a repeated parameter', () => {
    expect(parseWorkerParam('?worker=2&worker=3')).toBe(2);
    expect(parseWorkerParam('?worker=abc&worker=3')).toBeNull();
  });
});

describe('findAssignmentForWorker', () => {
  const assignment = (id: number, workerId: number): Assignment => ({
    id,
    worker: { id: workerId, fullName: `Worker ${workerId}` },
    participation: 'invited',
    attendance: 'not_started',
    invitedAt: null,
    respondedAt: null,
    cancelledAt: null,
    checkedInAt: null,
    checkedOutAt: null,
  });
  // Assignment ids deliberately differ from worker ids: the URL carries the worker id.
  const snapshot = { assignments: [assignment(11, 1), assignment(12, 2)] } as Snapshot;

  it('matches on the worker id, not the assignment id', () => {
    expect(findAssignmentForWorker(snapshot, 1)?.id).toBe(11);
    expect(findAssignmentForWorker(snapshot, 2)?.id).toBe(12);
    expect(findAssignmentForWorker(snapshot, 11)).toBeUndefined();
  });

  it('returns undefined for an unknown worker', () => {
    expect(findAssignmentForWorker(snapshot, 99)).toBeUndefined();
  });
});
