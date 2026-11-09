import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// In development the repository's .env is loaded; in Docker and CI the environment is set directly.
const rootEnvFile = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

const bool = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url(),
  DATABASE_OWNER_URL: z.string().url().optional(),
  APP_DB_PASSWORD: z.string().min(1).optional(),
  DEMO_MODE: bool,
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  SSE_MAX_CLIENTS: z.coerce.number().int().positive().default(100),
  SSE_PING_MS: z.coerce.number().int().positive().default(15_000),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),
  // Reverse proxies in front of the app (0 = none, 1 = Caddy). Needed so the rate limit sees the
  // real client address instead of the proxy's.
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid configuration. Check your environment or .env file:\n${problems}`);
  }
  return parsed.data;
}
