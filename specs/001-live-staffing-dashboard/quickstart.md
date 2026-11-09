# Quickstart: run and validate

Some commands below are targets. `npm run dev` (T078) does not exist yet. Until then, run the app like this
(the database container must be up, for example `docker compose up -d db`):

```bash
npm run build -w @staffing/web && npm run start -w @staffing/server   # http://localhost:3000
```

## Prerequisites

- Docker with Compose, Node.js 22, npm
- Copy `.env.example` to `.env`

## Run

```bash
docker compose up --build        # db + app, http://localhost:3000 (root compose.yaml includes infra/docker/docker-compose.yml)
npm run db:reset                 # back to the seed state (infra/scripts/reset-db.sh)
npm run e2e:docker               # e2e tests in containers, throwaway database (infra/docker/docker-compose.e2e.yml)
npm run dev                      # development: db in Docker, server and web with hot reload (infra/scripts/dev.sh)
```

All infrastructure files (Docker, Caddy, shell scripts, deployment guide) are in `infra/`; see
`infra/README.md`.

- Manager dashboard: `http://localhost:3000/`
- Worker view: `http://localhost:3000/worker` (optional `?worker=<id>`)

## Automated validation

```bash
npm test          # unit (transition table, counts) + API, concurrency, constraints on real Postgres
npm run e2e       # Playwright: two sessions, live sync, refresh, outage recovery
npm run measure   # 20 runs each: update delay and recovery time, median and max
```

## Manual validation scenarios

| # | Scenario | Expected | Spec |
|---|---|---|---|
| 1 | Open the dashboard after reset | 3 workers Uninvited / Not started; Filled 0/3, Remaining 3, Checked in 0, Checked out 0 | US1 |
| 2 | Manager invites Amina; worker view (other window) selects Amina | Worker view shows the invitation without refresh; dashboard shows invited time | US1, US2 |
| 3 | Amina accepts, checks in, checks out | Dashboard updates live each time; Filled stays 1 after check-out; times recorded | US2, US3 |
| 4 | Invite Youssef, he declines | Declined, no further actions; manager has no Invite for him | US2, A1 |
| 5 | Invite Salma, accept, cancel, accept again | Filled 1 → 2 → 1 → 2 | US2 |
| 6 | Double click Check in quickly | One check-in time. The UI sends one request, because the button is blocked while the first is pending; the "already checked in" answer of a second request is visible with `curl` or from two tabs | US4 |
| 7 | `curl -X POST .../check-in` twice for the same id | `changed:true` then `changed:false`, same `checkedInAt` | US4 |
| 8 | Check in after check-out | 409 with current state, clear message | US3, US4 |
| 9 | Ids `abc`, `-1`, `999999` | 400, 400, 404; never 500 | US4 |
| 10 | DevTools Offline on the dashboard, act from the worker window, back online | Offline indicator, then automatic catch-up to the new state | US4 |
| 11 | Stop the server, then start it | Indicator shows offline; recovers without refresh | US4 |
| 12 | `docker compose stop db`, try an action, `/api/health` | Clear failure message; health 503; recovers after `start` | US4 |
| 13 | Refresh at any point | Identical statuses and times | US4 |
| 14 | Demo mode: burst ×10, outage 5 s | One change and one timeline entry; badge Live → Reconnecting → Live | US6 |
| 15 | `curl -I /api/state` | `Cache-Control: no-store`, security headers present, `X-Request-Id` | R8 |

Record results in `docs/qa.md` (case, expected, actual, pass).

## References

- Endpoints and errors: [contracts/rest-api.md](contracts/rest-api.md)
- Stream behaviour: [contracts/live-updates.md](contracts/live-updates.md)
- Data shape: [contracts/snapshot.md](contracts/snapshot.md)
- Tables, constraints, transitions: [data-model.md](data-model.md)
- UI reference: Claude Design project "Shiftboard", `State Sheet.dc.html` (link in [plan.md](plan.md))
