import pg from 'pg';

export type Db = pg.Pool;
export type DbClient = pg.PoolClient;

/** Receives errors raised by pooled connections (for example when the database stops). */
export type PoolErrorHandler = (error: Error) => void;

const logToConsole: PoolErrorHandler = (error) => console.error('database pool error:', error.message);

/** A statement may run this long on the server before PostgreSQL aborts it. */
const STATEMENT_TIMEOUT_MS = 5_000;
/**
 * Backstop for a half-open socket, where the server never answers. It must be longer than the
 * statement timeout: when it fires the connection is unusable and is destroyed, not reused.
 */
const QUERY_TIMEOUT_MS = 8_000;

export function createPool(connectionString: string, onError: PoolErrorHandler = logToConsole): Db {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    // Fail fast when the database is down, so actions and health checks answer quickly.
    connectionTimeoutMillis: 2_000,
    // Enforced by PostgreSQL itself: the statement and its transaction abort normally, so ROLLBACK
    // works and the connection goes back to the pool clean.
    statement_timeout: STATEMENT_TIMEOUT_MS,
    query_timeout: QUERY_TIMEOUT_MS,
    idleTimeoutMillis: 30_000,
  });

  // The same failure can reach both listeners below, so report each error once.
  const reported = new WeakSet<Error>();
  const report = (error: Error) => {
    if (reported.has(error)) return;
    reported.add(error);
    onError(error);
  };

  // An idle connection that breaks emits `error` on the pool. Without a listener Node treats that
  // as uncaught and kills the process. The pool drops the broken client and opens a new one later.
  pool.on('error', report);
  // The pool stops listening to a connection while it is checked out, so a database that restarts
  // in the middle of a transaction would be uncaught too. Listen on every connection ourselves.
  pool.on('connect', (client) => client.on('error', report));
  return pool;
}

/** True for the error pg raises when its client-side timer gave up on a query. */
function isQueryTimeout(error: unknown): boolean {
  return error instanceof Error && /query read timeout/i.test(error.message);
}

/** Runs `work` inside one transaction; rolls back on any error. */
export async function withTransaction<T>(db: Db, work: (client: DbClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  // A connection that could not be rolled back may still be inside the transaction, holding its
  // locks. Destroy it instead of handing it to the next request.
  let discard = false;
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    if (isQueryTimeout(error)) {
      // The query is still running on a connection that stopped answering: do not wait behind it.
      discard = true;
    } else {
      await client.query('ROLLBACK').catch(() => {
        discard = true;
      });
    }
    throw error;
  } finally {
    client.release(discard);
  }
}
