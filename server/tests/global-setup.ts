import pg from 'pg';
import { testEnv } from './test-env.js';

/** Creates the test database once if it does not exist. Each test file resets it itself. */
export default async function setup(): Promise<void> {
  const env = testEnv();
  const ownerUrl = new URL(env.DATABASE_OWNER_URL!);
  const testDbName = ownerUrl.pathname.replace(/^\//, '');

  const maintenanceUrl = new URL(ownerUrl);
  maintenanceUrl.pathname = '/postgres';
  const client = new pg.Client({ connectionString: maintenanceUrl.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      testDbName,
    ]);
    if (!rowCount) {
      // Database names cannot be bound parameters; the name comes from our own config and is quoted.
      await client.query(`CREATE DATABASE ${pg.escapeIdentifier(testDbName)}`);
    }
  } finally {
    await client.end();
  }
}
