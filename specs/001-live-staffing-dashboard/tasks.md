---

description: "Task list for the Live Staffing Dashboard"
---

# Tasks: Live Staffing Dashboard

**Input**: Design documents from `/specs/001-live-staffing-dashboard/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. The constitution (Principle III) requires a test for every transition and API
tests against a real PostgreSQL; the spec's SC-002 and SC-004 require concurrency and transition
tests.

**Organization**: Tasks are grouped by user story. The generic action engine (transition table,
transaction, SSE hub) is foundational because every story uses it; each story then enables its own
actions, tests and screens.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 to US6 from spec.md
- Paths follow the plan's workspaces: `shared/`, `server/`, `web/`, `e2e/`; all infrastructure
  (Docker, Caddy, shell scripts, deploy docs) lives in `infra/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Repository, workspaces, tooling, local database

- [x] T001 Create root `.gitignore` (node_modules/, dist/, coverage/, .env, .env.*, !.env.example, playwright-report/, test-results/, .DS_Store, .claude/settings.local.json), `.editorconfig` (2 spaces, LF, utf-8) and `.nvmrc` containing `22`
- [x] T002 Create root `package.json` with npm workspaces `shared`, `server`, `web`, `e2e` and scripts `dev`, `build`, `test`, `e2e`, `measure`, `typecheck`, `lint`, `db:reset`
- [x] T003 [P] Create `tsconfig.base.json` (strict, ES2022, moduleResolution bundler) and per-workspace `tsconfig.json` in `shared/`, `server/`, `web/`, `e2e/`
- [x] T004 [P] Configure ESLint (flat config) and Prettier in `eslint.config.js` and `.prettierrc`, with a rule forbidding `dangerouslySetInnerHTML` in `web/`
- [x] T005 [P] Create `shared/package.json` (name `@staffing/shared`, depends on `zod`) with Vitest config in `shared/vitest.config.ts`
- [x] T006 [P] Create `server/package.json` (express@5, pg, zod, pino, pino-http, helmet, express-rate-limit; dev: vitest, supertest, tsx, @types/*) and `server/vitest.config.ts` (sequential runs, global setup that resets the test database)
- [x] T007 [P] Scaffold `web/` with Vite + React 18 + TypeScript, add Tailwind CSS and `motion`, proxy `/api` to `http://localhost:3000` in `web/vite.config.ts`
- [x] T008 [P] Create `e2e/package.json` with Playwright and `e2e/playwright.config.ts` (baseURL `http://localhost:3100`, Chromium; a `webServer` builds and starts the app on port 3100 against a dedicated `staffing_e2e` database)
- [x] T009 Create `infra/docker/docker-compose.yml` with service `db` (`postgres:16-alpine`, port `127.0.0.1:5432:5432`, named volume, healthcheck `pg_isready`) and service `app` (build context `../..`, dockerfile `infra/docker/Dockerfile`, configuration through variable interpolation with defaults instead of `env_file`, depends on healthy db, port 3000); create root `compose.yaml` containing only `include: [infra/docker/docker-compose.yml]` so `docker compose up --build` works from the root
- [x] T010 [P] Create `.env.example` documenting `DATABASE_URL` (staffing_app), `DATABASE_OWNER_URL` (staffing_owner), `PORT=3000`, `DEMO_MODE=false`, `LOG_LEVEL=info`, `SSE_MAX_CLIENTS=100`
- [x] T011 [P] Create `README.md` skeleton with headings: Setup, Reset, Architecture and design, Technology choices, Testing and measurements, Challenges and learnings, Limitations and improvements, AI usage
- [x] T012 [P] Create `AI_LOG.md` with the entry format: asked, produced, changed or rejected, verified

**Checkpoint**: `npm install` succeeds; `docker compose up db` reports healthy.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database, shared domain, generic action engine, live hub, web shell. Blocks all stories.

### Database

- [x] T013 Write `server/db/schema.sql`: tables `shifts`, `workers`, `assignments`, `events` exactly as in data-model.md, including `CHECK participation IN ('uninvited','invited','accepted','declined','cancelled')`, `CHECK attendance IN ('not_started','checked_in','checked_out')`, `attendance = 'not_started' OR participation = 'accepted'`, `invited_at IS NOT NULL` when participation is not `uninvited`, `checked_in_at IS NOT NULL` when attendance is `checked_in` or `checked_out`, `checked_out_at IS NOT NULL` exactly when attendance is `checked_out`, `checked_out_at >= checked_in_at`, `UNIQUE (shift_id, worker_id)`, `ends_at > starts_at`, `required_workers > 0`, `shifts.version bigint not null default 0`
- [x] T014 [P] Write `server/db/roles.sql`: `staffing_owner` owns the schema; `staffing_app` gets `SELECT, UPDATE` on shifts and assignments, `SELECT, INSERT` on events, `SELECT` on workers, usage on identity sequences, no DELETE and no DDL
- [x] T015 [P] Write `server/db/seed.sql`: shift "Rabat Tech Summit · Hall Setup", location "Main Hall, Rabat", `starts_at = now() + interval '2 hours'` (rounded to the minute), `ends_at = starts_at + interval '6 hours'`, required 3; workers Amina El Idrissi, Youssef Benali, Salma Haddad; 3 assignments `uninvited` / `not_started`; version 0; no events
- [x] T016 Create `infra/scripts/reset-db.sh` and `server/src/db/reset.ts` (run with the owner URL: drop schema, apply schema.sql, roles.sql, seed.sql), wired to `npm run db:reset`
- [x] T017 [P] Constraint tests in `server/tests/db/constraints.test.ts`: a direct `UPDATE` setting `attendance='checked_in'` on an `invited` row is refused; a duplicate `(shift_id, worker_id)` insert is refused; `staffing_app` cannot `DELETE FROM events`

### Shared domain

- [x] T018 [P] Define statuses, actions, actors, error codes, `Snapshot` and `ActionResult` as zod schemas plus inferred types in `shared/src/types.ts` and `shared/src/schemas.ts`, matching contracts/snapshot.md and contracts/rest-api.md
- [x] T019 [P] Implement the transition table and `applyAction(state, action)` in `shared/src/transitions.ts` (rows from data-model.md "State transitions", including the target state used for repeat detection; check-in target is `attendance = checked_in` only)
- [x] T020 [P] Implement `deriveCounts(assignments, requiredWorkers)` in `shared/src/counts.ts` (filled = accepted including checked in and out; remaining = required − filled; checkedIn; checkedOut; invited; declined; cancelled; uninvited)
- [x] T021 [P] Unit tests in `shared/tests/transitions.test.ts`: every allowed row succeeds; every other (state, action) pair is rejected, generated by iterating all participation × attendance × action combinations; repeats are detected as "already in target"
- [x] T022 [P] Unit tests in `shared/tests/counts.test.ts`: checked-out workers count as filled; `filled + remaining = required`; counts match a hand-built list for the seed, mid-shift and end-of-shift states

### Server core

- [x] T023 Implement `server/src/config.ts` (zod-validated env, clear startup error listing missing variables) and `server/src/db/pool.ts`
- [x] T024 [P] Implement `server/src/errors.ts`: `DomainError` with codes `VALIDATION_ERROR` 400, `NOT_FOUND` 404, `INVALID_TRANSITION` 409, `SHIFT_FULL` 409, `RATE_LIMITED` 429, `INTERNAL` 500, and the error middleware producing `{error:{code,message,current},requestId}` with no stack trace in the body
- [x] T025 Implement `server/src/app.ts` with middleware in this order: request id (reuse `X-Request-Id` or generate, echo it), pino-http, helmet (CSP `default-src 'self'`, `connect-src 'self'`), express-rate-limit on POST routes only, `express.json({limit:'10kb'})`, `Cache-Control: no-store` on `/api`, routes, 404 handler, error handler
- [x] T026 Implement `server/src/repository.ts` with parameterized SQL only: `getSnapshot(client)` (shift, assignments joined with workers, last 20 events newest first) and `toSnapshot(rows)` mapping snake_case to camelCase and timestamps to ISO strings, never returning `updated_at`
- [x] T027 Implement `server/src/service.ts` `runAction(assignmentId, action, actor)`: BEGIN; `SELECT ... FROM shifts ... FOR UPDATE`; for accept when not already accepted, count accepted and throw `SHIFT_FULL` if `>= required_workers`; conditional `UPDATE ... WHERE id = $1 AND <allowed> RETURNING`; decide first from the transition table after the lock (404, `changed:false`, or 409 with current state, no write), then run the guarded update; bump `shifts.version`, insert the event with that version, COMMIT; return `{changed, snapshot}`
- [x] T028 Implement `server/src/sse.ts` hub: on connect check `SSE_MAX_CLIENTS` (503 above), register client, write `retry: 2000`, then `event: snapshot`; `broadcast(snapshot)`; `event: ping` with `{serverTime}` every 15 s; remove on close; `closeAll()` for shutdown
- [x] T029 Implement `server/src/routes/state.ts`: `GET /api/state` (snapshot) and `GET /api/events` (SSE hub)
- [x] T030 Implement `server/src/routes/assignments.ts`: `POST /api/assignments/:id/:action` with zod (`id` positive integer, action in the route map `invite|accept|decline|cancel|check-in|check-out`, unknown action → 404), actor `manager` for invite and `worker` otherwise; call `runAction`, then `broadcast` when `changed`
- [x] T031 [P] Implement `server/src/routes/health.ts`: `GET /api/health` runs `SELECT 1`; `200 {status:'ok',db:'ok'}` or `503 {status:'degraded',db:'down'}`
- [x] T032 Implement `server/src/index.ts`: start the server, serve `web/dist` in production with SPA fallback, graceful shutdown on SIGTERM/SIGINT (stop accepting, `closeAll()` SSE, drain pool)
- [x] T033 [P] Test helpers in `server/tests/helpers.ts`: reset the DB before each test file, a Supertest agent, and a helper to read the next SSE `snapshot` event
- [x] T034 API tests in `server/tests/api/errors.test.ts`: ids `abc`, `-1`, `1; DROP TABLE workers` → 400 `VALIDATION_ERROR`; `999999` → 404; unknown action → 404; every error body has `code`, `message`, `requestId` and no stack

### Web shell

- [x] T035 Import the Claude Design project "Shiftboard" (`State Sheet.dc.html`, with `image-slot.js`, `shiftboard-data.js`, `support.js`) through the claude_design MCP and record its tokens (colours, type scale, spacing, radius, shadows, motion durations) in `web/src/index.css` (`@theme` tokens); note in `AI_LOG.md` anything in the design that the spec does not allow and was left out
- [x] T036 [P] Implement `web/src/lib/api.ts`: `postAction(assignmentId, action)` with 8 s `AbortController` timeout, `X-Request-Id`, up to 2 retries after 300 ms and 1 s on network errors and 5xx only, no retry on 4xx, typed `ActionResult` or `ApiError`
- [x] T037 [P] Implement `web/src/lib/live.ts`: `EventSource('/api/events')`, `status` (`live` | `reconnecting` | `offline`), `lastSyncedAt`, version guard (apply only if `version > current`), 35 s watchdog, manual reconnect with backoff 1 s, 2 s, 4 s, max 10 s after a closed stream; exported as a React hook `useLive()` that also accepts snapshots from HTTP responses through the same guard
- [x] T038 [P] Unit tests in `web/tests/live.test.ts` for the version guard (older or equal versions ignored) and the backoff sequence
- [x] T039 Implement routing and layout in `web/src/main.tsx` and `web/src/App.tsx`: `/` manager dashboard, `/worker` worker view, shared header with the connection status text
- [x] T040 [P] Implement `ParticipationPill` (solid tinted pill, text always shown) and `AttendanceChip` (outlined chip with icon, text always shown) in `web/src/components/StatusBadges.tsx` using the design tokens
- [x] T041 [P] Implement `web/src/components/Toasts.tsx` (success, neutral "already done", conflict, network failure) and a `useAction()` hook in `web/src/lib/useAction.ts` that disables the control while pending, maps `changed:false` to the neutral toast, 409 to the conflict toast with the server message, and final network failure to "Couldn't reach the server. Nothing was saved. Try again."

**Checkpoint**: `npm test` passes (unit, constraints, errors); `GET /api/state` returns the seed snapshot; both routes render with live status.

---

## Phase 3: User Story 1 - Manager invites workers and watches staffing live (Priority: P1) 🎯 MVP

**Goal**: The dashboard shows the shift, every worker's two statuses and four times, the counts, and Invite; it updates live.

**Independent Test**: After reset, invite one worker; the row shows Invited with a time and counts stay at Filled 0/3. Change that worker from a second session (or with curl) and the dashboard updates without refresh.

### Tests for User Story 1

- [x] T042 [P] [US1] API test in `server/tests/api/invite.test.ts`: invite uninvited → 200 `changed:true`, `invitedAt` set, version +1, one event with actor `manager`; invite again → 200 `changed:false`, same `invitedAt`; invite a declined worker → 409 `INVALID_TRANSITION` (A1)
- [x] T043 [P] [US1] SSE test in `server/tests/api/sse.test.ts`: a connected client receives the seed snapshot first, then a snapshot with the new version after an invite

### Implementation for User Story 1

- [x] T044 [P] [US1] Implement `web/src/components/ShiftHeader.tsx`: title, date, start to end time, location, required workers (times formatted with tabular numerals)
- [x] T045 [P] [US1] Implement `web/src/components/KpiRow.tsx`: Filled `x/required` with a segmented bar, Remaining, Checked in now, Checked out, all read from `snapshot.counts`
- [x] T046 [P] [US1] Implement `web/src/components/WorkerTable.tsx`: columns Worker (initials avatar + name), Participation, Attendance, Invited, Responded, Checked in, Checked out, Action; empty times shown as "—"; Invite button only for `uninvited` rows, using `useAction()`
- [x] T047 [US1] Implement `web/src/pages/Manager.tsx` composing ShiftHeader, KpiRow and WorkerTable from `useLive()`

**Checkpoint**: US1 independent test passes in the browser.

---

## Phase 4: User Story 2 - Worker responds to an invitation (Priority: P1)

**Goal**: A worker selects their name, sees the shift and their statuses, and can accept, decline, cancel and accept again.

**Independent Test**: Invite a worker, then in the worker view accept, cancel, accept again; each status and response time is saved, survives refresh, and Filled moves 0 → 1 → 0 → 1.

### Tests for User Story 2

- [x] T048 [P] [US2] API test in `server/tests/api/respond.test.ts`: accept invited → accepted, `respondedAt` set, filled +1; decline invited → declined; decline then accept → 409; cancel accepted+not_started → cancelled, `cancelledAt` set; accept cancelled → accepted again; accept uninvited → 409; repeated accept → `changed:false` with the same `respondedAt`
- [x] T049 [P] [US2] API test in `server/tests/api/shift-full.test.ts`: with `required_workers` set to 1 in the test DB, a second worker's accept → 409 `SHIFT_FULL` with `filled` and `required`; the first worker's repeated accept still → 200 `changed:false`

### Implementation for User Story 2

- [x] T050 [P] [US2] Implement `web/src/components/WorkerSelector.tsx` (initials avatars, keeps the choice in the `worker` query parameter) and `web/src/lib/workerParam.ts` (parse, select, clear, find the assignment by worker id; the parameter holds the worker id, not the assignment id)
  - Unit test `web/tests/workerParam.test.ts`: invalid values (`abc`, `0`, `-1`, `1.5`, `01`, empty, huge), repeated parameter, valid value; assignment lookup by worker id
  - Unit test `web/tests/workerView.test.ts`: allowed worker actions, order and messages for each of the 7 valid states
- [x] T051 [P] [US2] Implement `web/src/components/WorkerStatus.tsx`: "Participation: X" and "Attendance: Y" lines using the pill and chip, plus the recorded times (invited, accepted/declined/cancelled, checked in, checked out; empty ones omitted)
- [x] T052 [US2] Implement `web/src/components/WorkerActions.tsx` driven by `shared/src/transitions.ts` allowed actions: Invited → Accept + Decline; Accepted + Not started → Check in + text button "Cancel my spot"; Cancelled → "Accept again"; Uninvited → "No invitation yet"; Declined → final message; full-width buttons: primary and secondary 56 px, text button 48 px, all at least 44 px touch targets
- [x] T053 [US2] Implement `web/src/pages/Worker.tsx` composing selector, shift card, status, actions from `useLive()`

**Checkpoint**: US1 and US2 work together and independently.

---

## Phase 5: User Story 3 - Worker checks in and checks out (Priority: P1)

**Goal**: Accepted workers check in and out; check-out is final; participation stays Accepted.

**Independent Test**: With one accepted worker, check in then check out; both times recorded, Filled unchanged, Checked in 1 → 0, Checked out 0 → 1, no further actions.

### Tests for User Story 3

- [x] T054 [P] [US3] API test in `server/tests/api/attendance.test.ts` (routes `POST /api/assignments/:id/check-in` and `/check-out`): check in accepted+not_started → checked_in, `checkedInAt` set, participation still accepted, counts updated; check out → checked_out, `checkedOutAt >= checkedInAt`, filled unchanged; check in after check out → 409; cancel while checked in or after check out → 409; check in when uninvited, invited, declined or cancelled → 409; check out when not checked in → 409; every refusal leaves the version and events unchanged; repeated check-in and repeated check-out → `changed:false`, same time, same version; a check-in racing a check-out never returns 500

### Implementation for User Story 3

- [x] T055 [US3] Verify only, no new code: the Check out button and the "You checked out at HH:MM. Thanks!" final message (no buttons) were built with T052 in `web/src/components/WorkerActions.tsx`
- [x] T056 [US3] Verify that the "Checked in at HH:MM" and "Checked out at HH:MM" rows already built in `web/src/components/WorkerStatus.tsx` (T051) appear after check-in and check-out; no new code expected

**Checkpoint**: Full happy path invite → accept → check in → check out works across two windows.

---

## Phase 6: User Story 4 - Reliable actions and live connection (Priority: P1)

**Goal**: Repeats, retries, concurrency, refresh persistence, clear failures, offline indicator and automatic catch-up.

**Independent Test**: Rapid double click, refresh, network cut and restore: one recorded time, correct counts, visible offline indicator, automatic catch-up.

### Tests for User Story 4

- [x] T057 [P] [US4] Concurrency test in `server/tests/api/concurrency.test.ts`: 10 parallel identical check-ins → exactly 1 `changed:true`, 9 `changed:false`, 1 event, 1 `checkedInAt`, one broadcast; parallel cancel and check-in on the same assignment → always exactly one 200 `changed:true` and one 409 `INVALID_TRANSITION` (neither is the other's target state), final state valid; versions in events are exactly 1..n; check-in racing check-out on the same accepted worker → check-in 200, check-out 200 or 409, never 500
- [x] T058 [P] [US4] API test in `server/tests/api/health.test.ts`: health 200 with DB up; with the pool pointed at a stopped or wrong DB, health 503 and an action returns 500 `INTERNAL` with no stack in the body
- [x] T059 [P] [US4] Playwright test in `e2e/tests/live-sync.spec.ts`: manager and worker in two browser contexts; invite, accept, check in, check out; manager shows each change without reload; reload both pages and verify identical statuses and times
- [x] T060 [P] [US4] Playwright test in `e2e/tests/recovery.spec.ts`: `context.setOffline(true)` on the manager; the `offline` listener in `web/src/lib/live.ts` makes the app react at once, so the test does not depend on Chromium closing the open stream; act from the worker context, verify the offline indicator and banner, set online, verify Live within 15 s and the new state without reload

### Implementation for User Story 4

- [x] T061 [P] [US4] Implement `OfflineBanner` in `web/src/components/Connection.tsx`: shown while live updates are down, text "Live updates paused. Reconnecting… Actions may fail until we're back." followed by "Last update HH:MM." when a sync time is known (FR-024)
- [x] T062 [P] [US4] Implement `ConnectionBadge` (C1) in `web/src/components/Connection.tsx`: "● Live · synced Xs ago", "◐ Reconnecting…", "○ Offline, data from HH:MM"
- [x] T063 [US4] Mount OfflineBanner and ConnectionBadge in `web/src/pages/Manager.tsx` and `web/src/pages/Worker.tsx` (both views)
- [x] T064 [US4] Implement C7: logic in `web/src/lib/live.ts` (`remoteVersion`, `trackLocalRequest`) and `web/src/lib/remoteChange.ts`, UI in `web/src/components/RemoteChangeNotice.tsx`: when a snapshot changes the selected worker and the change was not this tab's own pending action, show "Updated from another session"
- [x] T065 [US4] Write `infra/scripts/qa-api.sh` (curl every endpoint, repeat actions, bad ids, `curl -I` headers) and record results of quickstart.md scenarios 1 to 13 and 15 in `docs/qa.md` (API part run by the script; browser-only scenarios listed as manual checks)

**Checkpoint**: All P1 stories done; `npm test` and `npm run e2e` green. This is the deliverable core.

---

## Phase 7: User Story 5 - Measured update delay and recovery time (Priority: P2)

**Goal**: Repeatable measurements with median and max.

**Independent Test**: `npm run measure` prints median and max for 20 runs of each, plus environment, and writes the raw samples.

- [x] T066 [US5] Implement `e2e/measure.ts` (with `e2e/measure/*`, `e2e/stats.ts` and the unit test `e2e/unit/stats.test.ts`): 20 measured runs of update delay (worker click to manager DOM showing the change) and 20 measured runs of recovery time, each after 6 warm-up runs that are kept in the output but not counted, with no database reset between runs. Both timestamps come from the same system clock via `Date.now()` taken inside each page (not a shared Playwright clock). Recovery uses `context.setOffline` on the manager for 5 s (under the client's 10 s probe) and means: the participation cell shows the new state AND the connection badge is Live; `/api/demo/outage` is not needed and stays a separate optional variant after T068. Shared server start and environment moved to `e2e/env.ts`, and the reset and wait helpers to `e2e/db.ts` and `e2e/live.ts`, so the Playwright config and the measurement cannot drift. Runs on the host (`npm run measure`) and in the e2e container (`npm run measure:docker`); prints median, p95, max, machine, OS, browser and the SC-005 / SC-006 verdicts, and writes every sample to `e2e/measure-results/<mode>-<ISO>.json`
- [x] T067 [US5] Record the method and the measured results for the host run and the Docker run in `docs/measurements.md` (no estimates, only real runs), and commit the raw JSON files it cites in `docs/measurements/`

---

## Phase 8: User Story 6 - Creative extras (Priority: P3)

**Goal**: Optional features that help understanding and the demo; each removable.

**Independent Test**: Each extra checked on its own (see spec US6 scenarios).

- [ ] T068 [P] [US6] Implement `server/src/routes/demo.ts` mounted only when `DEMO_MODE=true`: `POST /api/demo/burst` (10 parallel identical actions on a given assignment, returns `{sent, changed}`), `POST /api/demo/outage?seconds=N` (1 to 30, else 400; closes all SSE clients and returns 503 on `/api/events` for N seconds)
- [ ] T069 [P] [US6] API test in `server/tests/api/demo.test.ts`: routes return 404 when `DEMO_MODE` is off; burst produces exactly one change and one event
- [ ] T070 [P] [US6] Implement `web/src/components/DemoPanel.tsx` (C2): dashed border, "DEMO MODE" label, buttons "Spam check-in ×10" and "Simulate 5s outage"; rendered only when the server reports demo mode
- [ ] T071 [P] [US6] Implement `web/src/components/MetricsPanel.tsx` (C3) in a collapsible card: last update delay (client receive time minus event `at`), last recovery time, snapshot version
- [ ] T072 [P] [US6] Implement `web/src/components/ActivityTimeline.tsx` (C4) from `snapshot.recentEvents`, newest first, "HH:MM Amina checked in"; copy the beUI Timeline component and read it before committing
- [ ] T073 [P] [US6] Implement `web/src/components/ReadinessLine.tsx` (C5): plain sentence such as "2 of 3 places filled · starts in 3h · Salma accepted, not checked in yet"; "Shift complete" when everyone accepted has checked out
- [ ] T074 [P] [US6] Make the worker view mobile-first (C6) in `web/src/pages/Worker.tsx` and verify at 390 px width
- [ ] T075 [P] [US6] Finish deep links (C8): preselecting a worker and the fallback for unknown ids are built in T050 and T053; add the "copy worker link" icon in each `WorkerTable` row (the link uses the worker id, `/worker?worker=<worker id>`) and test the clipboard fallback. Note: `navigator.clipboard` is undefined over plain http at a non-localhost address (a phone on the same wifi, the e2e container), so the copy button needs a fallback: select the link in a text field and use `document.execCommand('copy')`, or show the link to copy by hand
- [ ] T076 [US6] Add Motion only through the copied beUI components (Toast Stack, Action Swap, Collapsible, Alert) and the KPI number pop-in; animate only opacity and transform; respect `prefers-reduced-motion`

---

## Phase 9: Polish & Cross-Cutting Concerns

- [x] T077 Write the multi-stage `infra/docker/Dockerfile` (build context is the repo root, trimmed by a root `.dockerignore` that excludes `.env`; build shared, web and server, with the server compiled to JavaScript through `server/tsconfig.build.json` and started with `node server/dist/index.js`; runtime image `staffing-app:local` with production deps only, non-root user, `HEALTHCHECK` on `/api/health`) and make the app apply schema, roles and seed on first start if the database is empty
- [ ] T078 [P] Write `infra/scripts/dev.sh` (start db, wait for health, run server and web in watch mode), wired to `npm run dev`
- [ ] T079 [P] Write `infra/scripts/server-init.sh` (fresh Ubuntu: Docker, deploy user, UFW 22/80/443), `infra/scripts/deploy.sh` (pull, build, `docker compose up -d`, wait for `/api/health`), `infra/caddy/Caddyfile` (automatic HTTPS, SSE buffering disabled with `flush_interval -1`) and `infra/README.md` (local run, reset, deploy, rollback, server requirements)
- [ ] T080 [P] Write `.github/workflows/ci.yml` (must stay there for GitHub): install, typecheck, lint, unit + API tests with a `postgres:16` service, `npm audit --omit=dev`, Docker build with `-f infra/docker/Dockerfile .`; optional Playwright job uploading the report on failure
- [ ] T081 Search `web/` for `dangerouslySetInnerHTML` (must be zero, copied beUI components included) and confirm security headers with `curl -I http://localhost:3000/api/state`
- [ ] T082 Fill `README.md` (linking to `infra/README.md` for deployment): setup, reset, endpoint table with error codes, architecture and state diagrams (Mermaid), technology choices with alternatives, testing and measurements, challenges and learnings, limitations (no auth: anyone with the URL can act as any worker; single process hub; no delivery guarantee), improvements, demo mode, AI usage
- [ ] T083 [P] Optional (P2): generate `openapi.json` from the zod schemas with `@asteasolutions/zod-to-openapi` and serve it at `/api/docs`
- [ ] T084 Complete `AI_LOG.md` with what was accepted, corrected and rejected
- [x] T086 [P2] Handover: run the e2e tests in a container, so the receiving team needs no local Node or browser install. A separate compose file `infra/docker/docker-compose.e2e.yml` (its own project `staffing-e2e`, a profile cannot set its own project name) using the official Playwright image pinned to the version in `package-lock.json` (`infra/docker/Dockerfile.e2e`), a throwaway in-memory database (never the demo data) and no published ports, started with `docker compose -f infra/docker/docker-compose.e2e.yml up --build --abort-on-container-exit --exit-code-from e2e` (wrapped by `npm run e2e:docker`). Depends on T077 (the app image). `e2e/env.ts` gets an external mode: `E2E_BASE_URL` and `E2E_DB_HOST` must be set together or not at all; the database host allowlist is localhost plus exactly `E2E_DB_HOST`, and the app URL must be localhost or a single-label compose service name. Document it in `infra/README.md`
- [ ] T085 Clean clone test: fresh folder, follow only the README, `docker compose up --build`, run quickstart.md scenarios; then re-read the brief and tick every requirement

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none
- **Foundational (Phase 2)**: depends on Setup; blocks all stories
- **US1, US2, US3, US4 (P1)**: depend on Foundational; best done in order US1 → US2 → US3 → US4 by one developer, but each is testable on its own because the action engine is shared
- **US5 (P2)**: depends on US1 to US4 (needs live sync and recovery); recovery uses Playwright offline mode (`setOffline`), so T068 is not needed
- **US6 (P3)**: depends on Foundational; C2 to C8 can be built in any order after US4
- **Polish**: T077 to T080 can start after Foundational; T082, T084, T085 last

### Within Each Story

- Tests first; they must fail before the screen or route work
- Server behaviour before UI that uses it
- Commit at each checkpoint (`feat:`, `test:`)

### Parallel Opportunities

- Setup: T003 to T008, T010 to T012
- Foundational: T014, T015, T017; T018 to T022; T024, T031, T033; T036 to T038, T040, T041
- US1: T042, T043, T044 to T046
- US2: T048 to T051
- US4: T057 to T062
- US6: T068 to T075
- Polish: T078 to T080, T083

---

## Parallel Example: User Story 1

```bash
Task: "API test for invite in server/tests/api/invite.test.ts"
Task: "SSE test in server/tests/api/sse.test.ts"
Task: "ShiftHeader in web/src/components/ShiftHeader.tsx"
Task: "KpiRow in web/src/components/KpiRow.tsx"
Task: "WorkerTable in web/src/components/WorkerTable.tsx"
```

---

## Implementation Strategy

### MVP First

1. Phase 1 and Phase 2
2. Phase 3 (US1): stop and validate the dashboard and live updates
3. US2 and US3 complete the business flow; US4 completes reliability. US1 to US4 together are the
   minimum deliverable for the brief.

### Incremental Delivery and cut order

1. Setup + Foundational → commit
2. US1 → US2 → US3 → US4, one commit per checkpoint
3. US5 measurements, then Docker + CI + README (T077, T080, T082) before any P3 extra
4. US6 extras in this order: C2 demo controls, C3 metrics, C4 timeline, then C5, C7, C8
5. Cut first if late: T083 (OpenAPI), T079 (server scripts), C5, C7, C8, then C3. Never cut P1
   tests, the connection badge, Docker setup, the README, or the clean clone test.

---

## Notes

- [P] tasks touch different files with no dependency on incomplete tasks
- Every business rule needs a test before its task is ticked (constitution III)
- Log each significant AI step in `AI_LOG.md` (constitution VII)
- The Claude Design project guides look and states; the spec decides behaviour
