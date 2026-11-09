import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Port of the app under test. Not 3000, so a running dev server is never touched. */
export const E2E_PORT = Number(process.env.E2E_PORT ?? 3100);

export const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

export type E2eDatabase = {
  /** Name of the dedicated database, always ending in `_e2e`. */
  name: string;
  appUrl: string;
  ownerUrl: string;
  appPassword: string;
};

/**
 * The end-to-end tests run against their own database (`<name>_e2e`). Resetting it between tests
 * wipes it, so it must never be the development database. URLs come from the repository .env.
 */
export function e2eDatabase(): E2eDatabase {
  const rootEnvFile = `${REPO_ROOT}.env`;
  if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

  const { DATABASE_URL, DATABASE_OWNER_URL, APP_DB_PASSWORD } = process.env;
  if (!DATABASE_URL || !DATABASE_OWNER_URL || !APP_DB_PASSWORD) {
    throw new Error('The e2e tests need DATABASE_URL, DATABASE_OWNER_URL and APP_DB_PASSWORD (see .env.example).');
  }
  const appUrl = toE2eDatabase(DATABASE_URL);
  return {
    name: new URL(appUrl).pathname.slice(1),
    appUrl,
    ownerUrl: toE2eDatabase(DATABASE_OWNER_URL),
    appPassword: APP_DB_PASSWORD,
  };
}

/** Hosts the e2e database may live on. Creating and wiping a database elsewhere is never intended. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

function toE2eDatabase(url: string): string {
  const parsed = new URL(url);
  if (!LOCAL_HOSTS.has(parsed.hostname)) {
    throw new Error(`Refusing to run the e2e tests against a database on "${parsed.hostname}": it is created and wiped.`);
  }
  const name = parsed.pathname.slice(1);
  if (!name.endsWith('_e2e')) parsed.pathname = `/${name}_e2e`;
  return parsed.toString();
}

/** Environment for the server process and for the reset script. Overrides anything in .env. */
export function e2eEnvironment(database: E2eDatabase = e2eDatabase()): Record<string, string> {
  return {
    DATABASE_URL: database.appUrl,
    DATABASE_OWNER_URL: database.ownerUrl,
    APP_DB_PASSWORD: database.appPassword,
  };
}
