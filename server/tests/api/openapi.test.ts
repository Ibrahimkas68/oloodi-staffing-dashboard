import request from 'supertest';
import { ACTION_PATHS, ERROR_CODES } from '@staffing/shared';
import { describe, expect, it } from 'vitest';
import { setupTestApp } from '../helpers.js';

const { app } = setupTestApp();

describe('GET /api/openapi.json', () => {
  it('serves an OpenAPI 3.1 document', async () => {
    const res = await request(app).get('/api/openapi.json');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body.openapi).toBe('3.1.0');
  });

  it('documents every endpoint of the contract, demo endpoints included (the test environment runs with DEMO_MODE=true)', async () => {
    const { body } = await request(app).get('/api/openapi.json');

    const expected = [
      'get /api/state',
      'get /api/events',
      'get /api/health',
      'post /api/demo/burst',
      'post /api/demo/outage',
      ...Object.values(ACTION_PATHS).map((segment) => `post /api/assignments/{id}/${segment}`),
    ];
    const documented = Object.entries(body.paths).flatMap(([path, methods]) =>
      Object.keys(methods as object).map((method) => `${method} ${path}`),
    );
    expect(documented.sort()).toEqual(expected.sort());
  });

  it('describes the snapshot, the action result and the error format', async () => {
    const { body } = await request(app).get('/api/openapi.json');

    expect(Object.keys(body.components.schemas)).toEqual(
      expect.arrayContaining(['Snapshot', 'ActionResult', 'ApiError']),
    );
    expect(JSON.stringify(body.components.schemas.ApiError)).toContain(ERROR_CODES[0]);
    const invite = body.paths['/api/assignments/{id}/invite'].post;
    expect(Object.keys(invite.responses)).toEqual(['200', '400', '404', '409', '429', '500']);
  });
});

describe('GET /api/docs', () => {
  it('serves a static page with no script or style, so the CSP stays untouched', async () => {
    const res = await request(app).get('/api/docs');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.text).toContain('/api/openapi.json');
    expect(res.text).toContain('POST /api/assignments/{id}/check-in');
    expect(res.text).not.toMatch(/<script|<style|style=|onclick/i);
  });
});
