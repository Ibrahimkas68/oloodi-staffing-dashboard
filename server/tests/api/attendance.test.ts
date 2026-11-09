import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { setupTestApp } from '../helpers.js';

const { app, db } = setupTestApp();

const AMINA = 1;
const post = (id: number, action: string) => request(app).post(`/api/assignments/${id}/${action}`);
const getState = () => request(app).get('/api/state');
const eventCount = async () => (await db.query('SELECT count(*)::int AS n FROM events')).rows[0].n as number;
const version = async () => (await getState()).body.version as number;

async function accepted(id: number) {
  await post(id, 'invite');
  return post(id, 'accept');
}

async function checkedIn(id: number) {
  await accepted(id);
  return post(id, 'check-in');
}

async function checkedOut(id: number) {
  await checkedIn(id);
  return post(id, 'check-out');
}

/** Asserts a refused action: 409, the exact message, the current state, and nothing written. */
async function expectRefused(
  act: () => request.Test,
  message: string,
  current: { participation: string; attendance: string },
) {
  const versionBefore = await version();
  const eventsBefore = await eventCount();
  const res = await act();

  expect(res.status).toBe(409);
  expect(res.body.error).toMatchObject({ code: 'INVALID_TRANSITION', message, current });
  expect(await version()).toBe(versionBefore);
  expect(await eventCount()).toBe(eventsBefore);
}

describe('US3 · check in and check out', () => {
  it('checks in an accepted worker: attendance changes, participation stays accepted', async () => {
    await accepted(AMINA);
    const res = await post(AMINA, 'check-in');

    expect(res.status).toBe(200);
    expect(res.body.changed).toBe(true);
    const amina = res.body.snapshot.assignments[0];
    expect(amina).toMatchObject({ participation: 'accepted', attendance: 'checked_in', checkedOutAt: null });
    expect(amina.checkedInAt).toEqual(expect.any(String));
    expect(res.body.snapshot.counts).toMatchObject({ filled: 1, remaining: 2, checkedIn: 1, checkedOut: 0 });
    expect(res.body.snapshot.recentEvents[0]).toMatchObject({
      action: 'check_in',
      actor: 'worker',
      assignmentId: AMINA,
      version: 3,
    });
    expect(res.body.snapshot.version).toBe(3);
  });

  it('checks out: attendance changes, check-in time is kept, filled is unchanged', async () => {
    const inRes = await checkedIn(AMINA);
    const res = await post(AMINA, 'check-out');

    expect(res.status).toBe(200);
    expect(res.body.changed).toBe(true);
    const before = inRes.body.snapshot.assignments[0];
    const amina = res.body.snapshot.assignments[0];
    expect(amina).toMatchObject({ participation: 'accepted', attendance: 'checked_out' });
    expect(amina.checkedInAt).toBe(before.checkedInAt);
    expect(Date.parse(amina.checkedOutAt)).toBeGreaterThanOrEqual(Date.parse(amina.checkedInAt));
    expect(res.body.snapshot.counts).toMatchObject({ filled: 1, remaining: 2, checkedIn: 0, checkedOut: 1 });
    expect(res.body.snapshot.recentEvents[0]).toMatchObject({ action: 'check_out', actor: 'worker', version: 4 });
  });

  it('refuses to check in again after checking out, and changes nothing', async () => {
    const outRes = await checkedOut(AMINA);
    const before = outRes.body.snapshot.assignments[0];

    await expectRefused(() => post(AMINA, 'check-in'), 'Cannot check in: this worker has already checked out.', {
      participation: 'accepted',
      attendance: 'checked_out',
    });

    const after = (await getState()).body.assignments[0];
    expect(after.checkedInAt).toBe(before.checkedInAt);
    expect(after.checkedOutAt).toBe(before.checkedOutAt);
  });

  it.each([
    ['while checked in', checkedIn, 'checked_in', 'already checked in'],
    ['after checking out', checkedOut, 'checked_out', 'already checked out'],
  ])('refuses to cancel %s', async (_label, setup, attendance, reason) => {
    await setup(AMINA);

    await expectRefused(() => post(AMINA, 'cancel'), `Cannot cancel: this worker has ${reason}.`, {
      participation: 'accepted',
      attendance,
    });
    expect((await getState()).body.counts.filled).toBe(1);
  });

  it.each([
    ['uninvited', async () => {}, 'uninvited', 'only an accepted worker can check in'],
    ['invited', async () => void (await post(AMINA, 'invite')), 'invited', 'only an accepted worker can check in'],
    [
      'declined',
      async () => {
        await post(AMINA, 'invite');
        await post(AMINA, 'decline');
      },
      'declined',
      'this worker declined the invitation',
    ],
    [
      'cancelled',
      async () => {
        await accepted(AMINA);
        await post(AMINA, 'cancel');
      },
      'cancelled',
      'this spot was cancelled',
    ],
  ])('refuses to check in a worker who is %s', async (_label, setup, participation, reason) => {
    await setup();

    await expectRefused(() => post(AMINA, 'check-in'), `Cannot check in: ${reason}.`, {
      participation,
      attendance: 'not_started',
    });
    expect((await getState()).body.assignments[0].checkedInAt).toBeNull();
  });

  it.each([
    ['uninvited', async () => {}, 'uninvited'],
    ['invited', async () => void (await post(AMINA, 'invite')), 'invited'],
    ['accepted but not checked in', async () => void (await accepted(AMINA)), 'accepted'],
  ])('refuses to check out a worker who is %s', async (_label, setup, participation) => {
    await setup();

    await expectRefused(() => post(AMINA, 'check-out'), 'Cannot check out: this worker has not checked in.', {
      participation,
      attendance: 'not_started',
    });
  });

  it('a repeated check-in changes nothing', async () => {
    const first = await checkedIn(AMINA);
    const versionBefore = await version();
    const eventsBefore = await eventCount();
    const second = await post(AMINA, 'check-in');

    expect(second.status).toBe(200);
    expect(second.body.changed).toBe(false);
    expect(second.body.snapshot.assignments[0].checkedInAt).toBe(first.body.snapshot.assignments[0].checkedInAt);
    expect(second.body.snapshot.version).toBe(versionBefore);
    expect(second.body.snapshot.counts.checkedIn).toBe(1);
    expect(await eventCount()).toBe(eventsBefore);
  });

  it('a repeated check-out changes nothing', async () => {
    const first = await checkedOut(AMINA);
    const versionBefore = await version();
    const eventsBefore = await eventCount();
    const second = await post(AMINA, 'check-out');

    expect(second.status).toBe(200);
    expect(second.body.changed).toBe(false);
    expect(second.body.snapshot.assignments[0].checkedOutAt).toBe(first.body.snapshot.assignments[0].checkedOutAt);
    expect(second.body.snapshot.version).toBe(versionBefore);
    expect(await eventCount()).toBe(eventsBefore);
  });

  it('accepting again after check-in is a no-op and keeps the attendance', async () => {
    await checkedIn(AMINA);
    const res = await post(AMINA, 'accept');

    expect(res.status).toBe(200);
    expect(res.body.changed).toBe(false);
    expect(res.body.snapshot.assignments[0].attendance).toBe('checked_in');
  });

  it('records check-in and check-out as worker events with increasing versions, newest first', async () => {
    await checkedOut(AMINA);

    const { rows } = await db.query('SELECT action, actor, version::int AS version FROM events ORDER BY id');
    expect(rows.slice(-2)).toEqual([
      { action: 'check_in', actor: 'worker', version: 3 },
      { action: 'check_out', actor: 'worker', version: 4 },
    ]);
    const versions = rows.map((row) => row.version);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
    expect(new Set(versions).size).toBe(versions.length);

    const recent = (await getState()).body.recentEvents;
    expect(recent.map((event: { action: string }) => event.action)).toEqual([
      'check_out',
      'check_in',
      'accept',
      'invite',
    ]);
    expect(recent[0].workerName).toBe('Amina El Idrissi');
  });

  it('GET /api/state matches each action response', async () => {
    await accepted(AMINA);

    for (const action of ['check-in', 'check-out']) {
      const res = await post(AMINA, action);
      const state = await getState();

      expect(state.body.assignments[0]).toEqual(res.body.snapshot.assignments[0]);
      expect(state.body.counts).toEqual(res.body.snapshot.counts);
      expect(state.body.version).toBe(res.body.snapshot.version);
    }
  });

  it('checking in one worker leaves the others untouched', async () => {
    await accepted(2);
    await accepted(3);
    const res = await checkedIn(AMINA);

    const attendance = res.body.snapshot.assignments.map((a: { attendance: string }) => a.attendance);
    expect(attendance).toEqual(['checked_in', 'not_started', 'not_started']);
    expect(res.body.snapshot.counts).toMatchObject({ filled: 3, checkedIn: 1, checkedOut: 0 });
  });

  // Guards the timestamp fix: a check-out that waited on the shift lock behind a check-in used to
  // get a transaction-start time older than the check-in and fail the time-order constraint (500).
  it('a check-in racing a check-out never causes a 500 and ends in a valid state', async () => {
    await accepted(AMINA);
    const versionBefore = await version();

    const [checkIn, checkOut] = await Promise.all([post(AMINA, 'check-in'), post(AMINA, 'check-out')]);

    expect(checkIn.status).toBe(200);
    expect([200, 409]).toContain(checkOut.status);
    const state = (await getState()).body;
    const amina = state.assignments[0];
    if (checkOut.status === 200) {
      expect(amina.attendance).toBe('checked_out');
      expect(Date.parse(amina.checkedOutAt)).toBeGreaterThanOrEqual(Date.parse(amina.checkedInAt));
    } else {
      expect(amina).toMatchObject({ attendance: 'checked_in', checkedOutAt: null });
    }
    const applied = [checkIn, checkOut].filter((res) => res.status === 200 && res.body.changed).length;
    expect(state.version).toBe(versionBefore + applied);
  });
});
