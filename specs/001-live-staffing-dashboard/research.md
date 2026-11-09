# Research: Live Staffing Dashboard

All Technical Context items were known from the cahier des charges; no NEEDS CLARIFICATION remained.
Each entry: Decision, Rationale, Alternatives considered.

## R1. Runtime and language

- **Decision**: TypeScript (strict) on Node.js 22 LTS for server, shared domain and web.
- **Rationale**: One language lets the transition table, `deriveCounts` and the snapshot type be
  shared and tested once. Node handles many idle SSE connections well (event loop, no thread per
  connection).
- **Alternatives**: Spring Boot (two languages, more setup), Go (no type sharing with the client),
  Python FastAPI (same).

## R2. HTTP framework

- **Decision**: Express 5.
- **Rationale**: Small and familiar; Express 5 forwards rejected promises to the error middleware, so
  async routes need no wrappers. About 11 routes do not need modules or dependency injection.
- **Alternatives**: NestJS (structure without a problem to solve here), Fastify (fine, less familiar).

## R3. Storage and data access

- **Decision**: PostgreSQL 16 in Docker Compose, `pg` driver, plain parameterized SQL.
- **Rationale**: CHECK and UNIQUE constraints, transactions, `SELECT ... FOR UPDATE` and
  `UPDATE ... WHERE <allowed state> RETURNING` make the rules hold under concurrency. Plain SQL keeps
  that logic visible in a code walk.
- **Alternatives**: SQLite (fallback if Docker fails; weaker concurrency story), Prisma/Drizzle
  (hide the conditional update), MongoDB (weaker for relational constraints).

## R4. Concurrency and idempotency

- **Decision**: One transaction per action. Order of steps: find the assignment (unknown id → `404`),
  lock the shift row (`SELECT ... FOR UPDATE`), then read the assignment state. Only after the lock
  is held, decide from the shared transition table (`applyAction`):
  - already in the action's target state → `200 changed:false`, nothing written;
  - not allowed from the current state → `409 INVALID_TRANSITION` with the current state;
  - Accept when every required place is taken → `409 SHIFT_FULL`;
  - otherwise run a guarded update (`WHERE id = $1 AND participation = <read> AND attendance =
    <read>`), increment `shifts.version`, insert the event with that version, commit, then broadcast.
  The guard is a safety net: the lock already makes the read stable, so a guarded update that
  matches no row is treated as a bug, not as a normal outcome.
- **Rationale**: The shift lock serializes changes per shift, so versions are strictly ordered and
  the capacity check is race-free. Deciding under the lock makes double clicks harmless and keeps
  timestamps unchanged, and the same table decides in the server, the database guard and the UI.
  Times use `clock_timestamp()` (the moment of the write, after the lock), so a request that waited
  on the lock never gets a time older than the change it followed.
- **Alternatives**: Optimistic locking with retries (more client logic), idempotency keys (not
  needed when the target state itself identifies a repeat), serializable isolation everywhere
  (retries on serialization failures).

## R5. Live update mechanism

- **Decision**: Native Server-Sent Events. Register the client first, then send `snapshot`;
  `retry: 2000`; named `ping` event every 15 s; full snapshot after each commit; cap on concurrent
  clients (503 above it).
- **Rationale**: Updates flow one way; actions already go over HTTP. `EventSource` reconnects on its
  own and is built into browsers. A full snapshot (3 rows) avoids any missed-event logic.
  Registering before reading the snapshot means no commit can fall between the two.
- **Alternatives**: WebSockets (two-way channel not needed, more code), Socket.IO (extra dependency
  and protocol), polling (delay equals interval, wasted requests).
- **Limits**: SSE does not guarantee delivery; the heartbeat and watchdog bound staleness. One
  process holds the hub; scaling out would use PostgreSQL `LISTEN/NOTIFY`. About 6 HTTP/1.1
  connections per site per browser; demo with separate windows or profiles.

## R6. Client live layer

- **Decision**: `live.ts` exposes `status` (live, reconnecting, offline), `lastSyncedAt` and
  `snapshot`. Version guard: apply a snapshot only if `version > current`. Watchdog: no snapshot or
  ping for 35 s → close and reconnect. If the stream closes for good (error status), reconnect
  manually with backoff 1 s, 2 s, 4 s, max 10 s. The browser's `offline` event shows Offline at
  once but never stops the reconnecting: a slow probe (10 s) continues until a valid snapshot
  arrives, because the event is only a hint and its matching `online` can be missed. The `online`
  event reconnects immediately.
- **Rationale**: The version guard covers both SSE and HTTP responses, so a late response never
  overwrites newer state. The watchdog catches silent dead connections.
- **Alternatives**: Trust `EventSource` alone (stops for good on HTTP errors, misses half-open
  sockets).

## R7. Client actions and retries

- **Decision**: `fetch` with an 8 s timeout (`AbortController`) and a request id; up to 2 retries
  after 300 ms and 1 s, only on network errors and 5xx. No retry on 4xx. Button disabled while
  pending. Nothing stored locally; final failure toast says nothing was saved.
- **Rationale**: Retries are safe because the server is idempotent; a lost response becomes
  "already done" with the original time.
- **Alternatives**: Offline queue with replay (stale actions, conflicts, false sense of saving),
  unlimited retries (hides real outages).

## R8. Validation, errors and security

- **Decision**: zod at the route boundary (`id` positive integer; action from the route). One error
  format `{error:{code,message,current},requestId}`; codes `VALIDATION_ERROR` 400, `NOT_FOUND` 404,
  `INVALID_TRANSITION` 409, `SHIFT_FULL` 409, `INTERNAL` 500. Middleware order: request id,
  pino-http, helmet, rate limit (POST only), JSON limit 10 kb, no-store, routes, 404, error handler.
  Parameterized SQL only; `staffing_app` role has no DDL or DELETE and can only INSERT events; no
  stack traces in responses; demo routes only when `DEMO_MODE=true`; one origin in production.
- **Rationale**: Constitution principles VI and the security constraints.
- **Alternatives**: Joi or hand-written checks (no shared types), class-based DTOs (more code for the
  same result).

## R9. API contract and documentation

- **Decision**: zod schemas and types in `shared/` are the contract; README endpoint table now;
  OpenAPI generated from the schemas only if time allows (P2).
- **Rationale**: Compile-time checks between client and server; generated docs cannot drift.
- **Alternatives**: Hand-written OpenAPI (drifts).

## R10. Frontend

- **Decision**: React 18 + Vite, Tailwind with tokens taken from the Claude Design project, Motion
  used only inside a few copied beUI components (Timeline, Toast Stack, Action Swap, Collapsible,
  Alert). Animate only opacity and transform; respect `prefers-reduced-motion`. No
  `dangerouslySetInnerHTML`.
- **Rationale**: Fast to build, consistent with the designed states, source owned in the repo.
- **Alternatives**: Plain CSS (fallback), full UI kits (heavy, generic), Next.js (SSR not needed).
- **Design source**: Claude Design project "Shiftboard", file `State Sheet.dc.html` (with
  `image-slot.js`, `shiftboard-data.js`, `support.js`), imported through the claude_design MCP at
  implementation time.

## R11. Testing and measurement

- **Decision**: Unit tests generated from the transition table (every allowed and every forbidden
  pair); API, concurrency (10 parallel identical actions, cancel vs check-in) and constraint tests
  against real Postgres; Playwright with two contexts for live sync, refresh and outage recovery;
  `measure.ts` runs 20 iterations of update delay (worker click → manager DOM, same clock) and
  recovery time (outage end → correct snapshot), printing median and max with the environment.
- **Rationale**: Constitution III; brief asks for measurements with explanation.
- **Alternatives**: Mocked DB (does not test the SQL that matters), Cypress (single-tab focus).

## R12. Packaging and delivery

- **Decision**: npm workspaces for code; all infrastructure grouped in `infra/` (Docker, Caddy,
  scripts, deploy docs), with a root `compose.yaml` that only includes
  `infra/docker/docker-compose.yml`; multi-stage Dockerfile that runs compiled JavaScript (`tsc` to `server/dist`, not tsx), non-root, healthcheck; Compose runs
  db + app (`docker compose up --build` from the root); Postgres bound to 127.0.0.1; schema and seed applied on first start
  if empty; GitHub Actions CI (typecheck, lint, unit + API tests with a Postgres service, `npm audit
  --omit=dev`, Docker build). The e2e tests also run in containers from a separate compose file
  (own project, throwaway database, official Playwright image pinned to the locked version).
- **Rationale**: A reviewer can run everything from a clean clone with one command.
- **Alternatives**: Local Postgres install (setup friction), cloud hosting (optional, not required).
