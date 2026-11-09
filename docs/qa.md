# QA results

Quickstart scenarios, run against the real app and a real Postgres. Source of the scenarios:
`specs/001-live-staffing-dashboard/quickstart.md`.

## How the app was run

`npm run dev` comes in a later task (T078). The tables below come from the first run, where the app
was started by hand with the database container up:

```bash
npm run build -w @staffing/web
npm run start -w @staffing/server          # http://localhost:3000
sh infra/scripts/qa-api.sh --yes --db-outage
```

The script resets the database named in `.env` first, so it wipes development data. Date of the
run: 2026-11-09, macOS, Node 22, Postgres 16 in Docker, server log level `warn`. The database was
reset again after the run.

### The same script against the Docker image

The script was run a second time against the container from `docker compose up --build` (image
`staffing-app:local`, started from an empty volume), on 2026-11-09, with `--db-outage`: **36 of 36
checks passed**, and a run without `--db-outage` passed too. During the outage the container did not
restart (restart count 0). The log shows the pool reporting the ten broken idle connections, then
the database host disappearing from DNS, and the app answering health with 503 until the database
came back. Other checks on the image: first start applies schema, roles and seed once; a restart
keeps the data and does not seed again; `docker stop` is graceful (SIGTERM logged, exit code 0,
under a second); the process runs as uid 1000 (`node`) on a read-only filesystem with no `.env`,
specs, e2e or test code inside.

## API checks (infra/scripts/qa-api.sh)

Result of the last run: all checks passed.

| Case | Expected | Actual | Pass |
|---|---|---|---|
| 1 initial state | 200 v=0 filled=0 remaining=3 uninvited=3 rows=3 | 200 v=0 filled=0 remaining=3 uninvited=3 rows=3 | PASS |
| 2 invite Amina | 200 changed=true v=1 filled=0 in=0 out=0 | 200 changed=true v=1 filled=0 in=0 out=0 | PASS |
| 3a Amina accepts | 200 changed=true v=2 filled=1 in=0 out=0 | 200 changed=true v=2 filled=1 in=0 out=0 | PASS |
| 3b Amina checks in | 200 changed=true v=3 filled=1 in=1 out=0 | 200 changed=true v=3 filled=1 in=1 out=0 | PASS |
| 3c Amina checks out (filled stays 1) | 200 changed=true v=4 filled=1 in=0 out=1 | 200 changed=true v=4 filled=1 in=0 out=1 | PASS |
| 4a invite Youssef | 200 changed=true v=5 filled=1 in=0 out=1 | 200 changed=true v=5 filled=1 in=0 out=1 | PASS |
| 4b Youssef declines | 200 changed=true v=6 filled=1 in=0 out=1 | 200 changed=true v=6 filled=1 in=0 out=1 | PASS |
| 4c re-invite of a declined worker is refused | 409 INVALID_TRANSITION Cannot invite: this worker declined this shift. | 409 INVALID_TRANSITION Cannot invite: this worker declined this shift. | PASS |
| 4d refusal changed nothing | v=6 filled=1 in=0 out=1 | v=6 filled=1 in=0 out=1 | PASS |
| 5a invite Salma | 200 changed=true v=7 filled=1 in=0 out=1 | 200 changed=true v=7 filled=1 in=0 out=1 | PASS |
| 5b Salma accepts (filled 2) | 200 changed=true v=8 filled=2 in=0 out=1 | 200 changed=true v=8 filled=2 in=0 out=1 | PASS |
| 5c Salma cancels (filled 1) | 200 changed=true v=9 filled=1 in=0 out=1 | 200 changed=true v=9 filled=1 in=0 out=1 | PASS |
| 5d Salma accepts again (filled 2) | 200 changed=true v=10 filled=2 in=0 out=1 | 200 changed=true v=10 filled=2 in=0 out=1 | PASS |
| 6 ten parallel check-ins: statuses | 10 200 | 10 200 | PASS |
| 6 ten parallel check-ins: responses with changed:true | 1 | 1 | PASS |
| 6 ten parallel check-ins: distinct checkedInAt values | 1 | 1 | PASS |
| 6 version moved once for the whole burst | v=11 filled=2 in=1 out=1 | v=11 filled=2 in=1 out=1 | PASS |
| 7 repeat check-in: changed false, same checkedInAt, same version | 200 false 2026-11-09T15:54:20.631Z 11 | 200 false 2026-11-09T15:54:20.631Z 11 | PASS |
| 8 check-in after check-out | 409 INVALID_TRANSITION Cannot check in: this worker has already checked out. | 409 INVALID_TRANSITION Cannot check in: this worker has already checked out. | PASS |
| 9a id abc | 400 | 400 | PASS |
| 9b id -1 | 400 | 400 | PASS |
| 9c id 999999 | 404 | 404 | PASS |
| 9d id with SQL text | 400 | 400 | PASS |
| 9e tables are intact after the SQL text | 200 3 | 200 3 | PASS |
| 13 two reads are equal apart from serverTime | identical | identical | PASS |
| 15a Cache-Control | no-store | no-store | PASS |
| 15b X-Content-Type-Options | nosniff | nosniff | PASS |
| 15c X-Request-Id | present | present | PASS |
| 15d Content-Security-Policy | present | present | PASS |
| 15e health | 200 ok | 200 ok | PASS |
| 12a health while the database is down | 503 degraded down | 503 degraded down | PASS |
| 12b action while the database is down | 500 INTERNAL | 500 INTERNAL | PASS |
| 12c message says nothing was saved | true | true | PASS |
| 12d server process still answers | 503 | 503 | PASS |
| 12e health after the database returns | 200 within 30 s | 200 within 30 s | PASS |
| 12f state readable again after recovery | 200 | 200 | PASS |

Quickstart scenarios covered here: 1, 2 to 5 (API side), 6 (server side), 7, 8, 9, 12 (`--db-outage`),
13 (two reads) and 15. In the table, "v" is the snapshot version and "in" and "out" are the checked
in and checked out counts.

## Manual browser checks

I could not open a browser for this run, so these are not run yet.

| Scenario | What to check | Status |
|---|---|---|
| 1 to 5 (visuals) | Dashboard and worker view look right in each state; times show as HH:MM | not run yet |
| 6 Double click | Double click Check in: one check-in time, no error toast (the button is blocked after the first click) | not run yet |
| 10 DevTools Offline | Offline on the dashboard, act from the worker window, back online: banner and badge react, state catches up without reload | not run yet (the same flow is covered by `e2e/tests/recovery.spec.ts`, which has not been run either) |
| 11 Stop the server | Stop and start the server: badge goes Reconnecting then Offline, then Live again without refresh | not run yet |
| 12 Database stop (UI) | `docker compose stop db`, press an action: honest failure toast; after `start`, actions work again | not run yet (the API side passed above) |
| 13 Refresh | Refresh at any point: identical statuses and times | not run yet (covered by `e2e/tests/live-sync.spec.ts`, not run yet) |
| 14 Demo mode | Burst and outage | not applicable until US6 |

## Notes

- With the database down, the badge can stay Live. Open live connections keep receiving pings from
  the server; only actions and new connections fail, and they fail with the honest toast.
- After `npm run db:reset`, tabs that are already open keep their old state until a reload. The
  client ignores snapshots that are not newer (the version guard), and a reset restarts the version
  at 0. A new connection after a reset is accepted, so a reload or a reconnect fixes it.
- The failure toast says "Nothing was saved". After a timeout the server may in fact have saved the
  change. Retries are safe because actions are idempotent (FR-020), so pressing the button again
  never records it twice.
- The database pool listens for errors on idle and checked-out connections, lets PostgreSQL abort
  a statement after 5 s, and destroys a connection that stopped answering instead of reusing it.
  During the outage run the server stayed up, kept answering `/api/health` with 503, and returned
  to 200 within 30 s of `docker compose start db` (the check polls once a second).
