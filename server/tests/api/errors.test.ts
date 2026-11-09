import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { setupTestApp } from '../helpers.js';

const { app } = setupTestApp();

function expectErrorShape(body: Record<string, unknown>, code: string) {
  expect(body).toMatchObject({ error: { code, message: expect.any(String) }, requestId: expect.any(String) });
  expect(JSON.stringify(body)).not.toMatch(/stack|at .+\.ts:\d+/);
}

describe('input validation and error format', () => {
  it.each(['abc', '-1', '0', '1.5', '1;%20DROP%20TABLE%20workers', '99999999999'])(
    'rejects id %s with 400 VALIDATION_ERROR',
    async (id) => {
      const res = await request(app).post(`/api/assignments/${id}/invite`);
      expect(res.status).toBe(400);
      expectErrorShape(res.body, 'VALIDATION_ERROR');
    },
  );

  it('returns 404 NOT_FOUND for an id that does not exist', async () => {
    const res = await request(app).post('/api/assignments/999999/invite');
    expect(res.status).toBe(404);
    expectErrorShape(res.body, 'NOT_FOUND');
  });

  it('returns 404 NOT_FOUND for an unknown action', async () => {
    const res = await request(app).post('/api/assignments/1/approve');
    expect(res.status).toBe(404);
    expectErrorShape(res.body, 'NOT_FOUND');
  });

  it('returns 404 NOT_FOUND for an unknown endpoint', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expectErrorShape(res.body, 'NOT_FOUND');
  });

  it('returns 400 for a malformed JSON body', async () => {
    const res = await request(app)
      .post('/api/assignments/1/invite')
      .set('Content-Type', 'application/json')
      .send('{"oops"');
    expect(res.status).toBe(400);
    expectErrorShape(res.body, 'VALIDATION_ERROR');
  });

  it('echoes a valid X-Request-Id and generates one otherwise', async () => {
    const reused = await request(app).get('/api/state').set('X-Request-Id', 'demo-123');
    expect(reused.headers['x-request-id']).toBe('demo-123');
    const generated = await request(app).get('/api/state').set('X-Request-Id', '<script>');
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('sends no-store and security headers on the API', async () => {
    const res = await request(app).get('/api/state');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('does not make browsers upgrade the page to https (a blank page on any non-localhost http address)', async () => {
    const res = await request(app).get('/api/state');
    expect(res.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
  });
});

describe('state', () => {
  it('returns the seed snapshot', async () => {
    const res = await request(app).get('/api/state');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      version: 0,
      shift: { title: 'Rabat Tech Summit · Hall Setup', requiredWorkers: 3 },
      counts: { filled: 0, remaining: 3, checkedIn: 0, checkedOut: 0, uninvited: 3 },
      recentEvents: [],
    });
    expect(res.body.assignments).toHaveLength(3);
  });
});
