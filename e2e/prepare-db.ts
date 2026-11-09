import pg from 'pg';
import { e2eDatabase } from './env.js';

/** Creates the dedicated e2e database if it does not exist. The server seeds it on first start. */
async function createDatabaseIfMissing(): Promise<void> {
  const { name, ownerUrl } = e2eDatabase();
  const maintenanceUrl = new URL(ownerUrl);
  maintenanceUrl.pathname = '/postgres';

  const client = new pg.Client({ connectionString: maintenanceUrl.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (!rowCount) {
      // Database names cannot be bound parameters; the name comes from our own config and is quoted.
      await client.query(`CREATE DATABASE ${pg.escapeIdentifier(name)}`);
      console.log(`Created database ${name}.`);
    }
  } finally {
    await client.end();
  }
}

await createDatabaseIfMissing();
