import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase } from '../../src/db/reset.js';
import { insertEvent, updateAssignment } from '../../src/repository.js';

const app = new pg.Pool({ connectionString: process.env.DATABASE_URL! });

beforeEach(async () => {
  await resetDatabase(process.env.DATABASE_OWNER_URL!, process.env.APP_DB_PASSWORD!);
  await app.query(
    `UPDATE assignments
        SET participation = 'accepted', invited_at = clock_timestamp(), responded_at = clock_timestamp()
      WHERE id = 1`,
  );
});

afterAll(async () => {
  await app.end();
});

/**
 * A request can wait on the shift lock after its transaction began. These tests simulate that wait
 * with pg_sleep: a time taken from now() would be the transaction start, so it would not be later
 * than now(). They fail with now() and pass with clock_timestamp().
 */
describe('write times come from the moment of the write', () => {
  async function inTransactionAfterDelay<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await app.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_sleep(0.05)');
      return await work(client);
    } finally {
      // Always roll back, also when an assertion fails: an open transaction would keep its row lock
      // and block the next test's database reset until the connection closes.
      await client.query('ROLLBACK').catch(() => undefined);
      client.release();
    }
  }

  it('stamps and updated_at are later than the transaction start', async () => {
    const row = await inTransactionAfterDelay(async (client) => {
      const from = { participation: 'accepted', attendance: 'not_started' } as const;
      const to = { participation: 'accepted', attendance: 'checked_in' } as const;
      expect(await updateAssignment(client, 1, from, to, ['checked_in_at'])).toBe(true);
      const { rows } = await client.query<{ stamp_is_later: boolean; updated_is_later: boolean }>(
        `SELECT checked_in_at > now() AS stamp_is_later, updated_at > now() AS updated_is_later
           FROM assignments WHERE id = 1`,
      );
      return rows[0];
    });

    expect(row).toEqual({ stamp_is_later: true, updated_is_later: true });
  });

  it('the event time is later than the transaction start', async () => {
    const later = await inTransactionAfterDelay(async (client) => {
      await insertEvent(client, { shiftId: 1, assignmentId: 1, action: 'check_in', actor: 'worker', version: 1 });
      const { rows } = await client.query<{ later: boolean }>('SELECT at > now() AS later FROM events WHERE assignment_id = 1');
      return rows[0]?.later;
    });

    expect(later).toBe(true);
  });
});
