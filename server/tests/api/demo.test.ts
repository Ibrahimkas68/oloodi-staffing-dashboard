import request from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';
import { buildTestApp, openStream, setupTestApp } from '../helpers.js';

// setupTestApp resets the database before every test; the second app shares that database.
const { app: appWithoutDemo, db } = setupTestApp({ demoMode: false });
const { app: appWithDemo, close: closeDemoApp } = buildTestApp(loadConfig().DATABASE_URL, {
  demoMode: true,
});
afterAll(closeDemoApp);

const OUTAGE_SECONDS = 1;
const OUTAGE_MARGIN_MS = 300;

let stream: Awaited<ReturnType<typeof openStream>> | undefined;
afterEach(async () => {
  await stream?.close();
  stream = undefined;
});

async function acceptWorker(id: number) {
  await request(appWithDemo).post(`/api/assignments/${id}/invite`).expect(200);
  await request(appWithDemo).post(`/api/assignments/${id}/accept`).expect(200);
}

describe('US6 · demo routes switched off', () => {
  it('do not exist and answer in the standard error format', async () => {
    const burst = await request(appWithoutDemo).post('/api/demo/burst?assignmentId=1');
    const outage = await request(appWithoutDemo).post('/api/demo/outage?seconds=1');

    for (const res of [burst, outage]) {
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.requestId).toEqual(expect.any(String));
    }
  });

  it('are not listed in the OpenAPI document', async () => {
    const { body } = await request(appWithoutDemo).get('/api/openapi.json');
    expect(Object.keys(body.paths).some((path) => path.includes('/demo/'))).toBe(false);
  });
});

describe('US6 · POST /api/demo/burst', () => {
  it('changes the assignment once and writes exactly one event', async () => {
    await acceptWorker(1);
    const { rows: before } = await db.query('SELECT count(*)::int AS n FROM events');

    const res = await request(appWithDemo).post('/api/demo/burst?assignmentId=1').expect(200);

    expect(res.body).toEqual({ sent: 10, changed: 1 });
    const { rows: after } = await db.query('SELECT count(*)::int AS n FROM events');
    expect(after[0].n - before[0].n).toBe(1);
    const { body } = await request(appWithDemo).get('/api/state');
    expect(body.assignments[0].attendance).toBe('checked_in');
  });

  it('broadcasts exactly one snapshot for the whole burst', async () => {
    await acceptWorker(1);
    stream = await openStream(appWithDemo);
    await stream.waitFor(1);

    await request(appWithDemo).post('/api/demo/burst?assignmentId=1&action=check-in').expect(200);
    // A later real change proves the burst produced no second snapshot of its own.
    await request(appWithDemo).post('/api/assignments/2/invite').expect(200);

    const snapshots = await stream.waitFor(3);
    expect(snapshots.map((snapshot) => snapshot.version)).toEqual([2, 3, 4]);
  });

  it.each([
    ['no assignmentId', '/api/demo/burst'],
    ['a non-numeric assignmentId', '/api/demo/burst?assignmentId=abc'],
    ['a zero assignmentId', '/api/demo/burst?assignmentId=0'],
    ['an unknown action', '/api/demo/burst?assignmentId=1&action=explode'],
  ])('rejects %s with VALIDATION_ERROR', async (_label, url) => {
    const res = await request(appWithDemo).post(url).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('keeps the normal errors: an unknown assignment is NOT_FOUND', async () => {
    const res = await request(appWithDemo).post('/api/demo/burst?assignmentId=999').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('US6 · POST /api/demo/outage', () => {
  it.each(['0', '31', 'abc', '1.5', '-1', ''])(
    'rejects seconds=%s with VALIDATION_ERROR',
    async (seconds) => {
      const res = await request(appWithDemo)
        .post(`/api/demo/outage?seconds=${seconds}`)
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    },
  );

  it('rejects a missing seconds', async () => {
    await request(appWithDemo).post('/api/demo/outage').expect(400);
  });

  it('closes live streams, answers 503 during the outage, then recovers by itself', async () => {
    stream = await openStream(appWithDemo);
    await stream.waitFor(1);

    await request(appWithDemo).post(`/api/demo/outage?seconds=${OUTAGE_SECONDS}`).expect(202);

    const during = await request(appWithDemo).get('/api/events').expect(503);
    expect(during.body.error.code).toBe('UNAVAILABLE');
    await request(appWithDemo).get('/api/state').expect(200);

    await new Promise((resolve) => setTimeout(resolve, OUTAGE_SECONDS * 1000 + OUTAGE_MARGIN_MS));
    await stream.close();
    stream = await openStream(appWithDemo);
    expect(await stream.waitFor(1)).toHaveLength(1);
  });
});
