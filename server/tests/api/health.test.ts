import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { buildTestApp, setupTestApp } from '../helpers.js';

const { app } = setupTestApp();

// Port 1 refuses connections at once, so "database down" cases do not wait for the 2 s timeout.
const down = buildTestApp('postgres://staffing_app:x@127.0.0.1:1/staffing_test');
afterAll(down.close);

function expectInternalError(body: Record<string, unknown>) {
  expect(body).toMatchObject({
    error: { code: 'INTERNAL', message: expect.stringContaining('Nothing was saved') },
    requestId: expect.any(String),
  });
  expect(JSON.stringify(body)).not.toMatch(/stack|at .+\.ts:\d+|\.ts:\d+/);
}

describe('health with the database up', () => {
  it('reports a healthy database', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'ok' });
  });
});

describe('with the database down', () => {
  it('reports a degraded health check', async () => {
    const res = await request(down.app).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'degraded', db: 'down' });
  });

  it('answers an action with an honest 500 and no technical details', async () => {
    const res = await request(down.app).post('/api/assignments/1/invite');

    expect(res.status).toBe(500);
    expectInternalError(res.body);
  });

  it('answers a state read with a 500 INTERNAL', async () => {
    const res = await request(down.app).get('/api/state');

    expect(res.status).toBe(500);
    expectInternalError(res.body);
  });

  it('ends a live stream without a snapshot and keeps serving requests', async () => {
    // supertest does not expose the body of an event stream by default, so read it explicitly. The
    // request only completes because the server ended the stream.
    const stream = await request(down.app)
      .get('/api/events')
      .buffer(true)
      .parse((res, done) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => (body += chunk));
        res.on('end', () => done(null, body));
      });

    expect(stream.status).toBe(200);
    expect(stream.headers['content-type']).toContain('text/event-stream');
    expect(stream.body).toContain('retry: 2000');
    expect(stream.body).not.toContain('event: snapshot');
    expect((await request(down.app).get('/api/health')).status).toBe(503);
  });
});
