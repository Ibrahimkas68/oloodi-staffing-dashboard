import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { openStream, setupTestApp } from '../helpers.js';

const { app } = setupTestApp();
let stream: Awaited<ReturnType<typeof openStream>> | undefined;

afterEach(async () => {
  await stream?.close();
  stream = undefined;
});

describe('US1 · live updates', () => {
  it('sends the current snapshot first, then a newer one after a change', async () => {
    stream = await openStream(app);
    const [first] = await stream.waitFor(1);
    expect(first).toMatchObject({ version: 0, counts: { uninvited: 3 } });

    await request(app).post('/api/assignments/1/invite').expect(200);

    const snapshots = await stream.waitFor(2);
    expect(snapshots[1]).toMatchObject({ version: 1, counts: { invited: 1 } });
    expect(snapshots[1]!.assignments[0]!.participation).toBe('invited');
  });

  it('does not broadcast a repeat that changed nothing', async () => {
    await request(app).post('/api/assignments/1/invite').expect(200);
    stream = await openStream(app);
    await stream.waitFor(1);

    await request(app).post('/api/assignments/1/invite').expect(200);
    // A real change afterwards proves the repeat produced no snapshot of its own.
    await request(app).post('/api/assignments/2/invite').expect(200);

    const snapshots = await stream.waitFor(2);
    expect(snapshots).toHaveLength(2);
    expect(snapshots[1]!.version).toBe(2);
  });
});
