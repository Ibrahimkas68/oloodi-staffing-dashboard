import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { setupTestApp } from '../helpers.js';

const { app, db } = setupTestApp();

const post = (id: number, action: string) => request(app).post(`/api/assignments/${id}/${action}`);

describe('US1 · manager invites', () => {
  it('invites an uninvited worker: Invited, time recorded, version +1, one manager event', async () => {
    const res = await post(1, 'invite');

    expect(res.status).toBe(200);
    expect(res.body.changed).toBe(true);
    const amina = res.body.snapshot.assignments[0];
    expect(amina).toMatchObject({ participation: 'invited', attendance: 'not_started' });
    expect(amina.invitedAt).toEqual(expect.any(String));
    expect(res.body.snapshot.version).toBe(1);
    expect(res.body.snapshot.recentEvents).toEqual([
      expect.objectContaining({ action: 'invite', actor: 'manager', assignmentId: 1, workerName: 'Amina El Idrissi', version: 1 }),
    ]);
    // Invited is not filled.
    expect(res.body.snapshot.counts).toMatchObject({ filled: 0, remaining: 3, invited: 1, uninvited: 2 });
  });

  it('a repeated invite changes nothing and keeps the original time', async () => {
    const first = await post(1, 'invite');
    const second = await post(1, 'invite');

    expect(second.status).toBe(200);
    expect(second.body.changed).toBe(false);
    expect(second.body.snapshot.version).toBe(1);
    expect(second.body.snapshot.assignments[0].invitedAt).toBe(first.body.snapshot.assignments[0].invitedAt);

    const { rows } = await db.query('SELECT count(*)::int AS n FROM events');
    expect(rows[0].n).toBe(1);
  });

  it('cannot re-invite a worker who declined (A1)', async () => {
    await post(2, 'invite');
    await post(2, 'decline');
    const res = await post(2, 'invite');

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: 'INVALID_TRANSITION',
      message: 'Cannot invite: this worker declined this shift.',
      current: { participation: 'declined', attendance: 'not_started' },
    });
  });

  it('refreshing keeps the invitation (state comes from the database)', async () => {
    const invited = await post(3, 'invite');
    const state = await request(app).get('/api/state');
    expect(state.body.assignments[2].invitedAt).toBe(invited.body.snapshot.assignments[2].invitedAt);
  });
});
