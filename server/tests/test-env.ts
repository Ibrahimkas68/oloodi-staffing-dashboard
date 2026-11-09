import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Tests run against a separate database (`<name>_test`) so they never wipe development data.
 * Connection strings are derived from the same .env (or CI environment) as the app.
 */
export function testEnv(): Record<string, string> {
  const rootEnvFile = fileURLToPath(new URL('../../.env', import.meta.url));
  if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

  const appUrl = process.env.DATABASE_URL;
  const ownerUrl = process.env.DATABASE_OWNER_URL;
  const appPassword = process.env.APP_DB_PASSWORD;
  if (!appUrl || !ownerUrl || !appPassword) {
    throw new Error('Tests need DATABASE_URL, DATABASE_OWNER_URL and APP_DB_PASSWORD (see .env.example).');
  }

  return {
    NODE_ENV: 'test',
    DATABASE_URL: toTestDatabase(appUrl),
    DATABASE_OWNER_URL: toTestDatabase(ownerUrl),
    APP_DB_PASSWORD: appPassword,
    LOG_LEVEL: 'silent',
    DEMO_MODE: 'true',
    RATE_LIMIT_PER_MINUTE: '10000',
    SSE_PING_MS: '15000',
  };
}

function toTestDatabase(url: string): string {
  const parsed = new URL(url);
  const name = parsed.pathname.replace(/^\//, '');
  if (!name.endsWith('_test')) parsed.pathname = `/${name}_test`;
  return parsed.toString();
}
