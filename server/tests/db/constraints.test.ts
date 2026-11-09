import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase } from '../../src/db/reset.js';

const ownerUrl = process.env.DATABASE_OWNER_URL!;
const appUrl = process.env.DATABASE_URL!;
const appPassword = process.env.APP_DB_PASSWORD!;

const app = new pg.Pool({ connectionString: appUrl });

beforeEach(async () => {
  await resetDatabase(ownerUrl, appPassword);
});

afterAll(async () => {
  await app.end();
});

describe('database constraints', () => {
  it('refuses attendance for a worker who has not accepted', async () => {
    await app.query(
      "UPDATE assignments SET participation = 'invited', invited_at = now() WHERE id = 1",
    );
    await expect(
      app.query(
        "UPDATE assignments SET attendance = 'checked_in', checked_in_at = now() WHERE id = 1",
      ),
    ).rejects.toMatchObject({ constraint: 'attendance_requires_accepted' });
  });

  it('refuses a status without its timestamp', async () => {
    await expect(
      app.query("UPDATE assignments SET participation = 'invited' WHERE id = 1"),
    ).rejects.toMatchObject({ constraint: 'invited_at_matches' });
  });

  it('refuses a check-out before the check-in', async () => {
    await expect(
      app.query(
        `UPDATE assignments
            SET participation = 'accepted', invited_at = now(), responded_at = now(),
                attendance = 'checked_out', checked_in_at = now(),
                checked_out_at = now() - interval '1 hour'
          WHERE id = 1`,
      ),
    ).rejects.toMatchObject({ constraint: 'checked_out_after_checked_in' });
  });

  it('refuses a second assignment for the same worker and shift', async () => {
    const owner = new pg.Client({ connectionString: ownerUrl });
    await owner.connect();
    try {
      await expect(
        owner.query('INSERT INTO assignments (shift_id, worker_id) VALUES (1, 1)'),
      ).rejects.toMatchObject({ constraint: 'one_assignment_per_worker' });
    } finally {
      await owner.end();
    }
  });
});

describe('least privilege for the app role', () => {
  it('cannot delete or rewrite events', async () => {
    await expect(app.query('DELETE FROM events')).rejects.toMatchObject({ code: '42501' });
    await expect(app.query('UPDATE events SET actor = actor')).rejects.toMatchObject({
      code: '42501',
    });
  });

  it('cannot delete assignments or change the schema', async () => {
    await expect(app.query('DELETE FROM assignments')).rejects.toMatchObject({ code: '42501' });
    await expect(app.query('DROP TABLE workers')).rejects.toMatchObject({ code: '42501' });
  });

  it('can append an event', async () => {
    const { rowCount } = await app.query(
      "INSERT INTO events (shift_id, assignment_id, action, actor, version) VALUES (1, 1, 'invite', 'manager', 1)",
    );
    expect(rowCount).toBe(1);
  });
});
