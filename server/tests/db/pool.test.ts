import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPool, withTransaction, type Db } from '../../src/db/pool.js';

const CLOSED_PORT_URL = 'postgres://staffing_app:x@127.0.0.1:1/staffing_test';
let pool: Db | undefined;

afterEach(async () => {
  await pool?.end();
  pool = undefined;
});

describe('createPool', () => {
  it('listens for idle-connection errors so the process does not crash', () => {
    pool = createPool(CLOSED_PORT_URL, () => undefined);

    expect(pool.listenerCount('error')).toBeGreaterThan(0);
    expect(() => pool!.emit('error', new Error('connection terminated'))).not.toThrow();
  });

  it('hands the error to the given handler', () => {
    const onError = vi.fn();
    pool = createPool(CLOSED_PORT_URL, onError);
    const error = new Error('database went away');

    pool.emit('error', error);

    expect(onError).toHaveBeenCalledWith(error);
  });

  it('logs to the console when no handler is given', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    pool = createPool(CLOSED_PORT_URL);

    expect(() => pool!.emit('error', new Error('x'))).not.toThrow();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('survives an error on a connection that is checked out (a database restart mid-transaction)', async () => {
    const onError = vi.fn();
    pool = createPool(process.env.DATABASE_URL!, onError);
    const client = await pool.connect();
    const error = new Error('terminating connection due to administrator command');

    // Without a listener on the connection itself this would be an uncaught exception.
    expect(() => client.emit('error', error)).not.toThrow();
    expect(onError).toHaveBeenCalledWith(error);
    client.release(true);
  });

  it('reports one error only once, even if it reaches both the connection and the pool', async () => {
    const onError = vi.fn();
    pool = createPool(process.env.DATABASE_URL!, onError);
    const client = await pool.connect();
    const error = new Error('boom');

    client.emit('error', error);
    pool.emit('error', error);

    expect(onError).toHaveBeenCalledTimes(1);
    client.release(true);
  });

  it('lets PostgreSQL abort slow statements, with a longer client-side backstop for dead sockets', () => {
    pool = createPool(CLOSED_PORT_URL, () => undefined);
    const options = (pool as unknown as { options: { statement_timeout: number; query_timeout: number } }).options;

    expect(options.statement_timeout).toBe(5_000);
    expect(options.query_timeout).toBeGreaterThan(options.statement_timeout);
  });
});

describe('withTransaction', () => {
  /** A stand-in connection: records the queries and the way it was released. */
  function fakeDb(onQuery: (sql: string) => Promise<unknown>) {
    const release = vi.fn();
    const query = vi.fn(onQuery);
    const db = { connect: async () => ({ query, release }) } as unknown as Db;
    return { db, query, release };
  }

  it('commits and returns the connection to the pool', async () => {
    const { db, query, release } = fakeDb(async () => ({}));

    await expect(withTransaction(db, async () => 'done')).resolves.toBe('done');

    expect(query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'COMMIT']);
    expect(release).toHaveBeenCalledWith(false);
  });

  it('rolls back on an error and reuses the connection', async () => {
    const { db, query, release } = fakeDb(async () => ({}));

    await expect(
      withTransaction(db, async () => {
        throw new Error('refused');
      }),
    ).rejects.toThrow('refused');

    expect(query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'ROLLBACK']);
    expect(release).toHaveBeenCalledWith(false);
  });

  it('destroys the connection when the rollback itself fails', async () => {
    const { db, release } = fakeDb(async (sql) => {
      if (sql === 'ROLLBACK') throw new Error('connection lost');
      return {};
    });

    await expect(
      withTransaction(db, async () => {
        throw new Error('first failure');
      }),
    ).rejects.toThrow('first failure');

    expect(release).toHaveBeenCalledWith(true);
  });

  it('destroys the connection after a client-side query timeout, without waiting behind the stuck query', async () => {
    const { db, query, release } = fakeDb(async () => ({}));

    await expect(
      withTransaction(db, async () => {
        throw new Error('Query read timeout');
      }),
    ).rejects.toThrow('Query read timeout');

    expect(query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN']);
    expect(release).toHaveBeenCalledWith(true);
  });
});
