import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { setupTestApp } from '../helpers.js';

const { app, db } = setupTestApp();

const post = (id: number, action: string) => request(app).post(`/api/assignments/${id}/${action}`);
const getState = () => request(app).get('/api/state');
const eventCount = async () => (await db.query('SELECT count(*)::int AS n FROM events')).rows[0].n as number;

describe('US2 · worker responds', () => {
  it('accepts an invitation: Accepted, response time set, filled 1, remaining 2', async () => {
    await post(1, 'invite');
    const res = await post(1, 'accept');

    expect(res.status).toBe(200);
    expect(res.body.changed).toBe(true);
    const amina = res.body.snapshot.assignments[0];
    expect(amina).toMatchObject({ participation: 'accepted', attendance: 'not_started' });
    expect(amina.respondedAt).toEqual(expect.any(String));
    expect(res.body.snapshot.counts).toMatchObject({ filled: 1, remaining: 2 });
    expect(res.body.snapshot.recentEvents[0]).toMatchObject({ action: 'accept', actor: 'worker', assignmentId: 1 });
  });

  it('declines an invitation: Declined, response time set', async () => {
    await post(2, 'invite');
    const res = await post(2, 'decline');

    expect(res.status).toBe(200);
    const youssef = res.body.snapshot.assignments[1];
    expect(youssef).toMatchObject({ participation: 'declined' });
    expect(youssef.respondedAt).toEqual(expect.any(String));
    expect(res.body.snapshot.counts.filled).toBe(0);
  });

  it('refuses to accept after declining (A2)', async () => {
    await post(2, 'invite');
    await post(2, 'decline');
    const res = await post(2, 'accept');

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: 'INVALID_TRANSITION',
      current: { participation: 'declined', attendance: 'not_started' },
    });
  });

  it('cancels an accepted spot: Cancelled, cancellation time set, filled back to 0', async () => {
    await post(1, 'invite');
    await post(1, 'accept');
    const res = await post(1, 'cancel');

    expect(res.status).toBe(200);
    const amina = res.body.snapshot.assignments[0];
    expect(amina.participation).toBe('cancelled');
    expect(amina.cancelledAt).toEqual(expect.any(String));
    expect(res.body.snapshot.counts.filled).toBe(0);
  });

  it('lets a cancelled worker accept again (filled 1)', async () => {
    await post(1, 'invite');
    await post(1, 'accept');
    await post(1, 'cancel');
    const res = await post(1, 'accept');

    expect(res.status).toBe(200);
    expect(res.body.changed).toBe(true);
    expect(res.body.snapshot.assignments[0].participation).toBe('accepted');
    expect(res.body.snapshot.counts.filled).toBe(1);
    // Accepting only stamps the response time, so the old cancellation time stays on the record.
    // The worker view must not show a "Cancelled at" row for an accepted worker.
    expect(res.body.snapshot.assignments[0].cancelledAt).toEqual(expect.any(String));
  });

  it('refuses to accept before being invited', async () => {
    const res = await post(1, 'accept');

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
    expect(res.body.error.message).toContain('not been invited yet');
  });

  it('a repeated accept changes nothing: same time, same version, no new event', async () => {
    await post(1, 'invite');
    const first = await post(1, 'accept');
    const events = await eventCount();
    const second = await post(1, 'accept');

    expect(second.status).toBe(200);
    expect(second.body.changed).toBe(false);
    expect(second.body.snapshot.assignments[0].respondedAt).toBe(first.body.snapshot.assignments[0].respondedAt);
    expect(second.body.snapshot.version).toBe(first.body.snapshot.version);
    expect(await eventCount()).toBe(events);
  });

  it('repeated decline and repeated cancel are also no-ops', async () => {
    await post(1, 'invite');
    await post(1, 'accept');
    await post(1, 'cancel');
    await post(2, 'invite');
    await post(2, 'decline');
    const events = await eventCount();

    const cancelAgain = await post(1, 'cancel');
    const declineAgain = await post(2, 'decline');

    expect(cancelAgain.body.changed).toBe(false);
    expect(declineAgain.body.changed).toBe(false);
    expect(await eventCount()).toBe(events);
  });

  it('refuses to decline an accepted spot and says to cancel instead', async () => {
    await post(1, 'invite');
    await post(1, 'accept');
    const res = await post(1, 'decline');

    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('Cancel instead');
  });

  it('refuses to cancel an invitation that was never accepted', async () => {
    await post(1, 'invite');
    const res = await post(1, 'cancel');

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('follows the independent test: filled goes 0, 1, 0, 1 and GET /api/state agrees each time', async () => {
    const steps: Array<{ action: string; filled: number }> = [
      { action: 'invite', filled: 0 },
      { action: 'accept', filled: 1 },
      { action: 'cancel', filled: 0 },
      { action: 'accept', filled: 1 },
    ];

    for (const { action, filled } of steps) {
      const res = await post(1, action);
      expect(res.body.snapshot.counts.filled).toBe(filled);

      const state = await getState();
      expect(state.body.counts.filled).toBe(filled);
      expect(state.body.assignments[0]).toEqual(res.body.snapshot.assignments[0]);
    }
  });
});
