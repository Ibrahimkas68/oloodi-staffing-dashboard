# Implementation Plan: Live Staffing Dashboard

**Branch**: `001-live-staffing-dashboard` | **Date**: 2026-11-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-live-staffing-dashboard/spec.md`

## Summary

One shift, three workers, two views (manager dashboard, worker view) in separate browser sessions.
A single Node.js service validates every action against a transition table and applies it inside one
PostgreSQL transaction (row lock on the shift, conditional update, append-only event, version bump).
After each commit the server pushes a full, versioned snapshot to every open view over Server-Sent
Events. Clients apply a snapshot only if its version is newer, show a live/reconnecting/offline badge,
and catch up automatically because every (re)connect starts with a full snapshot. Repeats are
idempotent (`200 changed:false`, timestamps kept); forbidden actions return `409` with the current
state. Details and rationale: [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5 (strict) on Node.js 22 LTS; same language in the browser

**Primary Dependencies**: Server: Express 5, `pg`, zod, pino + pino-http, helmet, express-rate-limit.
Web: React 18, Vite, Tailwind CSS, Motion, a few copied beUI components (MIT). Shared: zod schemas
and types in `shared/`.

**Storage**: PostgreSQL 16 in Docker Compose; plain parameterized SQL, no ORM; two roles
(`staffing_owner` for schema/reset, `staffing_app` least privilege)

**Testing**: Vitest (unit, pure domain), Vitest + Supertest against a real Postgres (API,
concurrency, constraints), Playwright with two browser contexts (end to end, measurements)

**Target Platform**: Linux container (Docker), modern desktop and mobile browsers

**Project Type**: Web application (one backend service serving the built frontend, one database)

**Performance Goals**: Median update delay under 1 s on a local setup (SC-005, target to confirm by
measurement); recovery after reconnect within 15 s (SC-006)

**Constraints**: One process and one origin; no Redis, queue, ORM, auth or cache; no offline action
queue; full snapshot on every change; API responses `Cache-Control: no-store`

**Scale/Scope**: 1 shift, 3 workers, a handful of concurrent sessions; 2 screens plus a state sheet

**UI reference (Claude Design)**: project "Shiftboard",
<https://claude.ai/design/p/fd41112f-11b1-4f30-a591-359c608016bd?file=State+Sheet.dc.html>.
Main file `State Sheet.dc.html`, which imports `image-slot.js`, `shiftboard-data.js` and `support.js`.
Import it through the claude_design MCP (`https://api.anthropic.com/v1/design/mcp`, auth via
`/design-login`) during the frontend phase. It is the visual source for tokens, components and
states; the spec and this plan stay the source for behaviour. Where the design shows something the
spec does not allow (an extra status or action), the spec wins.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Pre-research | Post-design |
|---|---|---|---|
| I. Simplicity First | One service, one DB, one web client; no ORM, Redis, queue, auth, cache | Pass | Pass: 4 workspaces but one deployable service; dependencies listed above, each justified in research.md |
| II. Database Enforces the Rules | Constraints + conditional updates, one transaction per action, derived counts | Pass | Pass: see data-model.md constraints and transaction steps |
| III. Every Transition Is Tested | Table-driven unit tests, API tests on real Postgres | Pass | Pass: test layout below; quickstart lists the checks |
| IV. Server Is the Source of Truth | Full snapshot on connect and change, version guard, no local queue | Pass | Pass: contracts/live-updates.md |
| V. Safe Repeats | `200 changed:false`, `409` with current state, no duplicates | Pass | Pass: contracts/rest-api.md decision rule |
| VI. Honest Feedback | One error format, nothing shown as saved without confirmation, measured numbers only | Pass | Pass: error contract + client retry policy in research.md |
| VII. Owned AI Work | Read and test before commit, `AI_LOG.md` | Pass | Pass: process rule, checked at each commit |
| Tech and security constraints | Parameterized SQL, least-privilege role, helmet, rate limit, demo mode flag | Pass | Pass: research.md R8 |

No violations. Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-live-staffing-dashboard/
├── plan.md              # This file
├── research.md          # Phase 0: decisions and rationale
├── data-model.md        # Phase 1: tables, constraints, transitions, transaction
├── quickstart.md        # Phase 1: how to run and validate end to end
├── contracts/
│   ├── rest-api.md      # HTTP endpoints, decision rule, error format
│   ├── live-updates.md  # SSE stream: events, ordering, client rules
│   └── snapshot.md      # Snapshot shape shared by HTTP and SSE
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
shared/                     # used by server and web
└── src/
    ├── transitions.ts      # transition table + applyAction (pure)
    ├── counts.ts           # deriveCounts (pure)
    ├── types.ts            # Snapshot, Assignment, statuses, error codes
    └── schemas.ts          # zod schemas (params, responses)

server/
├── src/
│   ├── index.ts            # start, graceful shutdown
│   ├── app.ts              # express app + middleware order
│   ├── config.ts           # env parsing with zod
│   ├── db/pool.ts
│   ├── repository.ts       # SQL only (parameterized), toSnapshot mapper
│   ├── service.ts          # one transaction per action, decision rule
│   ├── sse.ts              # hub: register, snapshot, ping, broadcast, cap
│   ├── errors.ts           # domain errors → HTTP
│   └── routes/
│       ├── state.ts        # GET /api/state, GET /api/events
│       ├── assignments.ts  # POST /api/assignments/:id/:action
│       ├── health.ts
│       └── demo.ts         # mounted only if DEMO_MODE
├── db/
│   ├── schema.sql
│   ├── roles.sql
│   └── seed.sql
└── tests/
    ├── api/                # Supertest against real Postgres
    └── db/                 # constraint tests

web/
└── src/
    ├── lib/api.ts          # fetch wrapper: timeout, retries, request id
    ├── lib/live.ts         # EventSource, version guard, watchdog, backoff
    ├── pages/Manager.tsx
    ├── pages/Worker.tsx
    ├── components/         # pills, chips, KPI, table, toasts, badge, beUI copies
    └── styles/             # Tailwind config with tokens from the Claude Design project

e2e/
├── tests/                  # Playwright, two contexts
└── measure.ts              # 20-run update delay and recovery measurements

infra/                      # everything about running, building and deploying
├── README.md               # how to run locally, reset, deploy, roll back; server requirements
├── docker/
│   ├── Dockerfile          # multi-stage, compiled JavaScript, non-root, HEALTHCHECK (build context: repo root)
│   ├── Dockerfile.e2e      # Playwright image pinned to the locked version, runs the e2e tests
│   ├── docker-compose.yml  # db (127.0.0.1 only, volume, healthcheck) + app
│   └── docker-compose.e2e.yml  # e2e containers: own project, throwaway database, no ports
├── caddy/
│   └── Caddyfile           # reverse proxy example, automatic HTTPS, SSE buffering off
└── scripts/
    ├── dev.sh              # db up, wait for health, server + web in watch mode
    ├── reset-db.sh         # drop, recreate, seed (owner role)
    ├── qa-api.sh           # manual API checks with curl
    ├── e2e-docker.sh       # e2e containers: up, then always down -v
    ├── server-init.sh      # fresh Ubuntu VPS: Docker, deploy user, UFW
    └── deploy.sh           # pull, build, up -d, wait for /api/health

compose.yaml                # one line: include infra/docker/docker-compose.yml
.dockerignore               # root, because the Docker build context is the repository root
.env.example                # root, read by npm scripts and Compose
.github/workflows/ci.yml    # GitHub only reads workflows here; it calls infra/ scripts
```

**Structure Decision**: npm workspaces (`shared`, `server`, `web`, `e2e`) for code, and one `infra/`
folder for everything about running, building and deploying. Only `server` is deployed; in
production it serves the built `web` files, so there is one origin and no CORS. `shared` holds the
pure domain logic so the same transition table and counts run in tests, server and client.

Three files stay outside `infra/` on purpose:
- `compose.yaml` at the root only includes `infra/docker/docker-compose.yml`, so reviewers still run
  `docker compose up --build` from the root with no extra flags.
- `.env.example` stays at the root because both npm scripts and Compose read `.env` from there.
- `.github/workflows/ci.yml` must live in `.github/workflows/` for GitHub to run it.

The SQL files (`server/db/schema.sql`, `roles.sql`, `seed.sql`) stay with the server: the app
applies them on first start and the API tests reset the database with them, so they are part of the
application, not the infrastructure.

## Complexity Tracking

No constitution violations to justify.
