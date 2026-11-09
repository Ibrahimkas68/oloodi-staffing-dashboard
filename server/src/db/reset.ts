import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const sqlDir = fileURLToPath(new URL('../../db/', import.meta.url));

async function readSql(name: string): Promise<string> {
  return readFile(`${sqlDir}${name}`, 'utf8');
}

/**
 * Drops and recreates the schema, applies least-privilege grants and loads the seed.
 * Must run with the owner connection string, never the app one.
 */
export async function resetDatabase(ownerUrl: string, appPassword: string): Promise<void> {
  const client = new pg.Client({ connectionString: ownerUrl });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(await readSql('schema.sql'));
    // The password goes in as a bound parameter, then roles.sql reads it with current_setting.
    await client.query("SELECT set_config('staffing.app_password', $1, true)", [appPassword]);
    await client.query(await readSql('roles.sql'));
    await client.query(await readSql('seed.sql'));
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

/** True when the schema has not been created yet (used for first start in Docker). */
export async function isDatabaseEmpty(ownerUrl: string): Promise<boolean> {
  const client = new pg.Client({ connectionString: ownerUrl });
  await client.connect();
  try {
    const { rows } = await client.query<{ exists: boolean }>(
      "SELECT to_regclass('public.shifts') IS NOT NULL AS exists",
    );
    return !rows[0]?.exists;
  } finally {
    await client.end();
  }
}

// CLI: `npm run db:reset`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { loadConfig } = await import('../config.js');
  const config = loadConfig();
  if (!config.DATABASE_OWNER_URL || !config.APP_DB_PASSWORD) {
    console.error('DATABASE_OWNER_URL and APP_DB_PASSWORD are required to reset the database.');
    process.exit(1);
  }
  await resetDatabase(config.DATABASE_OWNER_URL, config.APP_DB_PASSWORD);
  console.log('Database reset: schema, roles and seed applied.');
}
