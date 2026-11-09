import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { setupTestApp } from '../helpers.js';

const { app, db } = setupTestApp();

const post = (id: number, action: string) => request(app).post(`/api/assignments/${id}/${action}`);
const eventCount = async () => (await db.query('SELECT count(*)::int AS n FROM events')).rows[0].n as number;

/** A shift with one place, two invited workers, and the first one already accepted. */
async function oneSeatTakenByWorkerOne() {
  await db.query('UPDATE shifts SET required_workers = 1');
  await post(1, 'invite');
  await post(2, 'invite');
  await post(1, 'accept');
}

describe('US2 · shift is full', () => {
  it('refuses a second accept with SHIFT_FULL and leaves everything unchanged', async () => {
    await oneSeatTakenByWorkerOne();
    const before = (await request(app).get('/api/state')).body;
    const events = await eventCount();

    const res = await post(2, 'accept');

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: 'SHIFT_FULL',
      filled: 1,
      required: 1,
      current: { participation: 'invited', attendance: 'not_started' },
    });

    const after = (await request(app).get('/api/state')).body;
    expect(after.assignments[1].participation).toBe('invited');
    expect(after.version).toBe(before.version);
    expect(after.shift.requiredWorkers).toBe(1);
    expect(await eventCount()).toBe(events);
  });

  it('still answers the worker who holds the place: a repeated accept is 200 changed:false', async () => {
    await oneSeatTakenByWorkerOne();
    const res = await post(1, 'accept');

    expect(res.status).toBe(200);
    expect(res.body.changed).toBe(false);
  });

  it('frees the place when the first worker cancels', async () => {
    await oneSeatTakenByWorkerOne();
    await post(1, 'cancel');
    const res = await post(2, 'accept');

    expect(res.status).toBe(200);
    expect(res.body.snapshot.counts.filled).toBe(1);
  });
});
