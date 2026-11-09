import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { openStream, setupTestApp } from '../helpers.js';

const { app, db } = setupTestApp();

const WORKERS = [1, 2, 3];
/** The pool holds 10 connections; a burst of exactly this size never waits for a free one. */
const BURST_SIZE = 10;
const TEST_TIMEOUT_MS = 15_000;

const post = (id: number, action: string) => request(app).post(`/api/assignments/${id}/${action}`);
const getState = () => request(app).get('/api/state');

async function accept(ids: number[]) {
  for (const id of ids) {
    await post(id, 'invite').expect(200);
    await post(id, 'accept').expect(200);
  }
}

/** Every committed event must carry its own version, counting up from 1 with no gap or repeat. */
async function expectVersionsToCountUp() {
  const { rows } = await db.query('SELECT version::int AS version FROM events ORDER BY id');
  const versions = rows.map((row) => row.version as number);
  expect(versions).toEqual(versions.map((_, index) => index + 1));
}

let stream: Awaited<ReturnType<typeof openStream>> | undefined;
afterEach(async () => {
  await stream?.close();
  stream = undefined;
});

describe('US4 · concurrent actions', () => {
  it(
    'ten parallel check-ins change the worker once and broadcast once',
    async () => {
      await accept([1]);
      stream = await openStream(app);
      await stream.waitFor(1);

      const responses = await Promise.all(Array.from({ length: BURST_SIZE }, () => post(1, 'check-in')));

      expect(responses.map((res) => res.status)).toEqual(Array(BURST_SIZE).fill(200));
      const changed = responses.filter((res) => res.body.changed);
      expect(changed).toHaveLength(1);
      const stamps = new Set(responses.map((res) => res.body.snapshot.assignments[0].checkedInAt));
      expect(stamps.size).toBe(1);
      const { rows } = await db.query("SELECT count(*)::int AS n FROM events WHERE action = 'check_in'");
      expect(rows[0].n).toBe(1);

      // A real change afterwards proves the nine repeats produced no snapshots of their own.
      await post(2, 'invite').expect(200);
      const snapshots = await stream.waitFor(3);
      expect(snapshots).toHaveLength(3);
      expect(snapshots.map((snapshot) => snapshot.version)).toEqual([2, 3, 4]);
      await expectVersionsToCountUp();
    },
    TEST_TIMEOUT_MS,
  );

  it('a cancel racing a check-in always gives one success and one refusal', async () => {
    await accept(WORKERS);

    const responses = await Promise.all(
      WORKERS.flatMap((id) => [post(id, 'check-in'), post(id, 'cancel')]),
    );

    WORKERS.forEach((_id, index) => {
      const [checkIn, cancel] = [responses[index * 2]!, responses[index * 2 + 1]!];
      // Neither action is the other's target state, so the loser is always refused, never a no-op.
      const outcomes = [checkIn, cancel].map((res) => res.status).sort();
      expect(outcomes).toEqual([200, 409]);
      const winner = [checkIn, cancel].find((res) => res.status === 200)!;
      const loser = [checkIn, cancel].find((res) => res.status === 409)!;
      expect(winner.body.changed).toBe(true);
      expect(loser.body.error.code).toBe('INVALID_TRANSITION');
    });
    const { assignments } = (await getState()).body;
    for (const assignment of assignments) {
      expect([assignment.participation, assignment.attendance]).toSatisfy(
        (state: string[]) =>
          (state[0] === 'accepted' && state[1] === 'checked_in') ||
          (state[0] === 'cancelled' && state[1] === 'not_started'),
      );
    }
    await expectVersionsToCountUp();
  });

  it('a check-in racing a check-out on three workers never causes a 500', async () => {
    await accept(WORKERS);

    const responses = await Promise.all(
      WORKERS.flatMap((id) => [post(id, 'check-in'), post(id, 'check-out')]),
    );

    responses.forEach((res, index) => {
      if (index % 2 === 0) expect(res.status).toBe(200);
      else expect([200, 409]).toContain(res.status);
    });
    const { assignments } = (await getState()).body;
    for (const assignment of assignments) {
      expect(['checked_in', 'checked_out']).toContain(assignment.attendance);
      if (assignment.checkedOutAt) {
        expect(Date.parse(assignment.checkedOutAt)).toBeGreaterThanOrEqual(Date.parse(assignment.checkedInAt));
      }
    }
    await expectVersionsToCountUp();
  });
});
