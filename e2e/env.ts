import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Port of the app under test in local mode. Not 3000, so a running dev server is never touched. */
export const E2E_PORT = Number(process.env.E2E_PORT ?? 3100);

export const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

type Env = NodeJS.ProcessEnv;

/** Hosts that always mean "this machine". */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/**
 * Where the app under test runs.
 * - local: this config starts the server itself on E2E_PORT (the default).
 * - external: the app already runs elsewhere (the e2e container), reached by E2E_BASE_URL, and its
 *   database lives on the compose host named by E2E_DB_HOST.
 * The two variables only make sense together, so setting just one is an error.
 */
export type E2eTarget =
  | { mode: 'local'; baseUrl: string; extraDatabaseHost: null }
  | { mode: 'external'; baseUrl: string; extraDatabaseHost: string };

export function e2eTarget(env: Env = process.env): E2eTarget {
  const baseUrl = env.E2E_BASE_URL || undefined;
  const databaseHost = env.E2E_DB_HOST || undefined;
  if (!baseUrl && !databaseHost) {
    return { mode: 'local', baseUrl: `http://localhost:${E2E_PORT}`, extraDatabaseHost: null };
  }
  if (!baseUrl || !databaseHost) {
    throw new Error('Set both E2E_BASE_URL and E2E_DB_HOST (external app) or neither (local app).');
  }
  const databaseService = databaseHost.toLowerCase();
  assertTestableBaseUrl(baseUrl);
  if (!isComposeServiceName(databaseService)) {
    throw new Error(`Refusing E2E_DB_HOST "${databaseHost}": it must be a compose service name such as "db-e2e".`);
  }
  return { mode: 'external', baseUrl, extraDatabaseHost: databaseService };
}

/**
 * A compose service name: a single DNS label (letters, digits, hyphens). Never an address, a name
 * with dots, a port, or one of the local hosts.
 */
function isComposeServiceName(name: string): boolean {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name) && !LOCAL_HOSTS.has(name);
}

/**
 * External mode is for the e2e container: the app under test must be a compose service
 * (for example http://app-e2e:3000). An arbitrary remote site is never accepted, and neither is an
 * app on this machine: that would let the tests drive the dev server while the reset wipes another
 * database. To test an app on this machine use local mode (unset both variables).
 */
function assertTestableBaseUrl(baseUrl: string): void {
  const { protocol, hostname } = new URL(baseUrl);
  const isHttp = protocol === 'http:' || protocol === 'https:';
  if (!isHttp || !isComposeServiceName(hostname)) {
    throw new Error(
      `Refusing E2E_BASE_URL "${baseUrl}": external mode only accepts a compose service name, ` +
        'for example http://app-e2e:3000. For an app on this machine, unset E2E_BASE_URL and E2E_DB_HOST.',
    );
  }
}

export type E2eDatabase = {
  /** Name of the dedicated database, always ending in `_e2e`. */
  name: string;
  appUrl: string;
  ownerUrl: string;
  appPassword: string;
};

/**
 * The end-to-end tests run against their own database (`<name>_e2e`). Resetting it between tests
 * wipes it, so it must never be the development database. URLs come from the repository .env
 * (local mode) or straight from the environment (container).
 */
export function e2eDatabase(env: Env = process.env): E2eDatabase {
  const rootEnvFile = `${REPO_ROOT}.env`;
  if (env === process.env && existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

  const { DATABASE_URL, DATABASE_OWNER_URL, APP_DB_PASSWORD } = env;
  if (!DATABASE_URL || !DATABASE_OWNER_URL || !APP_DB_PASSWORD) {
    throw new Error(
      'The e2e tests need DATABASE_URL, DATABASE_OWNER_URL and APP_DB_PASSWORD (see .env.example).',
    );
  }
  const { extraDatabaseHost } = e2eTarget(env);
  const allowedHosts = new Set([...LOCAL_HOSTS, ...(extraDatabaseHost ? [extraDatabaseHost] : [])]);
  const appUrl = toE2eDatabase(DATABASE_URL, allowedHosts);
  return {
    name: new URL(appUrl).pathname.slice(1),
    appUrl,
    ownerUrl: toE2eDatabase(DATABASE_OWNER_URL, allowedHosts),
    appPassword: APP_DB_PASSWORD,
  };
}

function toE2eDatabase(url: string, allowedHosts: Set<string>): string {
  const parsed = new URL(url);
  if (!allowedHosts.has(parsed.hostname)) {
    throw new Error(
      `Refusing to run the e2e tests against a database on "${parsed.hostname}": it is created and wiped.`,
    );
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
