import pg from 'pg';

export type Db = pg.Pool;
export type DbClient = pg.PoolClient;

export function createPool(connectionString: string): Db {
  return new pg.Pool({
    connectionString,
    max: 10,
    // Fail fast when the database is down, so actions and health checks answer quickly.
    connectionTimeoutMillis: 2_000,
    idleTimeoutMillis: 30_000,
  });
}

/** Runs `work` inside one transaction; rolls back on any error. */
export async function withTransaction<T>(db: Db, work: (client: DbClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
