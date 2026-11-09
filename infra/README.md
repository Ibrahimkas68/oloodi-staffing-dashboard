# Infrastructure

Everything about running and packaging the app lives here. The root `compose.yaml` only includes
`docker/docker-compose.yml`, so every command below runs from the repository root.

## What is in this folder

| Path | Purpose |
| --- | --- |
| `docker/Dockerfile` | App image: compiled JavaScript, production dependencies only, non-root. |
| `docker/docker-compose.yml` | The demo stack: `db` (PostgreSQL 16) and `app`. |
| `docker/Dockerfile.e2e` | Test runner image based on the official Playwright image. |
| `docker/docker-compose.e2e.yml` | End-to-end tests in containers, with a throwaway database. |
| `scripts/reset-db.sh` | Drop, recreate and seed the database (`npm run db:reset`). |
| `scripts/qa-api.sh` | Manual API checks with curl. |
| `scripts/e2e-docker.sh` | Runs the e2e containers and always cleans up (`npm run e2e:docker`, or `npm run measure:docker` for the measurement). |

The build context is the repository root, and `.dockerignore` there keeps `.env`, `node_modules`,
`.git` and documentation out of every image.

## Run

```bash
cp .env.example .env        # optional: every variable has a working default
docker compose up --build
```

Open http://localhost:3000 (manager dashboard) and http://localhost:3000/worker (worker view).

The app speaks plain HTTP, so it also works from another device on the same network, for example
the worker view on a phone at `http://<your computer's address>:3000/worker`. Browsers treat such a
page as "not secure" (some features are missing there, which the app copes with), so for a real
deployment put a reverse proxy with HTTPS in front of it (T079).

| Port | What | Reachable from |
| --- | --- | --- |
| 3000 | App (API, live updates and the built web app) | Your machine and your network |
| 5432 | PostgreSQL | `127.0.0.1` only |

Stop with `docker compose down` (data is kept in the `pgdata` volume) or `docker compose down -v`
(data is deleted).

## Configuration

Set these in `.env` or in your shell. Each has a default, so none is required.

| Variable | Default | Meaning |
| --- | --- | --- |
| `POSTGRES_DB` | `staffing` | Database name. |
| `POSTGRES_OWNER_USER` | `staffing_owner` | Owner role: creates the schema, runs reset and seed. |
| `POSTGRES_OWNER_PASSWORD` | `staffing_owner_dev` | Password of the owner role. |
| `APP_DB_PASSWORD` | `staffing_app_dev` | Password of the least-privilege role the running app uses. |
| `POSTGRES_PORT` | `5432` | Host port for PostgreSQL (bound to `127.0.0.1`). |
| `DEMO_MODE` | `false` | `true` enables the `/api/demo/*` endpoints. Keep `false` outside demos. |
| `LOG_LEVEL` | `info` | `fatal`, `error`, `warn`, `info`, `debug`, `trace`. |
| `SSE_MAX_CLIENTS` | `100` | Maximum live-update connections; above it the API answers 503. |
| `RATE_LIMIT_PER_MINUTE` | `120` | Requests per minute per client before the API answers 429. |

The default passwords are committed and meant for local use only.

Passwords are applied when the database volume is first created. Changing them later has no effect
on an existing volume: either run `docker compose down -v` (deletes the data) or change the roles
yourself with `ALTER ROLE`. Passwords with `@`, `:` or `/` break the connection URLs; use letters
and digits.

## First start and restarts

On the first start the database is empty, so the app creates the schema and roles and loads the
seed data, then starts serving. On later starts it finds the schema and leaves the data alone.
`docker compose restart` and `docker compose down` followed by `up` keep your data.

## Reset the demo data

With the stack running and a `.env` file (the defaults in `.env.example` match the compose
defaults):

```bash
npm run db:reset
```

This drops and recreates the schema in the compose database and loads the seed again.

## The app image

- Compiled JavaScript: the server is built with `tsc` and started with `node server/dist/index.js`.
  The image holds no TypeScript sources, tests, specs or `.env`.
- Three stages: build (all dependencies, builds shared, web and server), production dependencies
  only, and a small runtime stage.
- Runs as the non-root `node` user. In Compose the container also has a read-only file system, no
  extra Linux capabilities and `no-new-privileges`, because the app writes nothing to disk.
- Health check: `GET /api/health` every 15 seconds, with a 30 second start period. `app` starts
  only after `db` reports healthy.
- Graceful stop: on `SIGTERM` the app closes live connections, finishes requests and closes the
  database pool. Compose waits 15 seconds before killing it.

## End-to-end tests in a container

The receiving team needs no local Node or browser for this:

```bash
npm run e2e:docker
```

That runs `infra/scripts/e2e-docker.sh`, which is the same as:

```bash
docker compose -f infra/docker/docker-compose.e2e.yml up --build --abort-on-container-exit --exit-code-from e2e
docker compose -f infra/docker/docker-compose.e2e.yml down -v
```

- It has its own Compose project (`staffing-e2e`), so it can run next to the demo stack. It uses
  its own database `staffing_e2e` kept in memory, publishes no ports and declares no volumes, so it
  never touches the demo data.
- The `e2e` container runs the Playwright tests against the `app-e2e` container, built from the same
  app image. The command exits with the test result.
- The tests reset the database between tests, so they are strict about what they may touch. The
  database name must end in `_e2e` (it is rewritten if not). Locally (no `E2E_*` variables) the
  database must be on this machine. In the container, `E2E_BASE_URL` and `E2E_DB_HOST` must both be
  set, and both must be Compose service names (for example `app-e2e` and `db-e2e`): an app or a
  database on this machine, or anywhere else, is refused. Setting only one of the two is an error.
- The first run downloads the Playwright image, which is large (over 1 GB).
- The HTML report and traces are written to `e2e/playwright-report` and `e2e/test-results`. On
  Linux they may be owned by root.

## Measurement in a container

```bash
npm run measure:docker
```

That runs `infra/scripts/e2e-docker.sh measure`: it builds the images, starts the app and its
throwaway database, and runs `e2e/measure.ts` in the `measure` service (Compose profile `measure`,
so `npm run e2e:docker` never starts it). The raw samples are written to `e2e/measure-results/`.

- The numbers are container numbers. Chromium, the app and Postgres run inside a Linux VM, so the CPU,
  RAM and OS in the output describe that VM, not the Mac. Never merge them with a run on the host
  (`npm run measure`). See `docs/measurements.md`.
- The image has no `.git`, so the script passes the commit and the Docker host description
  (`MEASURE_GIT_COMMIT`, `MEASURE_GIT_DIRTY`, `MEASURE_DOCKER_INFO`) to the container.

## Troubleshooting

- Logs: `docker compose logs app` (and `docker compose logs db`).
- The app exits with "cannot prepare the database as the owner role": the volume was created with
  other passwords. Run `docker compose down -v` and start again, or restore the old passwords.
- "port is already allocated": something else uses 3000 or 5432. Stop it, or set `POSTGRES_PORT`
  for the database. The app port is fixed at 3000 in `docker/docker-compose.yml`.
- `npm run db:reset` cannot connect: check that the stack is running and `.env` matches the
  passwords in use.

## Not yet

Deployment to a server, the Caddy reverse proxy and server setup are not written yet (task T079).
