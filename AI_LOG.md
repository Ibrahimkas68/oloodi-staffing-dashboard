# AI usage log

Every significant AI-assisted step: what I asked, what the tool produced, what I changed or
rejected, and how I verified it. Tools: Claude (Claude Code), Spec Kit, Claude Design.

Rule: no generated code is committed before I have read it and a test or a recorded manual check
covers it.

## Entry format

### YYYY-MM-DD · Phase or task · Tool
- **Asked:**
- **Produced:**
- **Changed or rejected:**
- **Verified:**

---

## Entries

### 2026-11-08 · Specification · Spec Kit + Claude
- **Asked:** constitution, one core spec, plan and tasks from my cahier des charges.
- **Produced:** `.specify/memory/constitution.md` and `specs/001-live-staffing-dashboard/`
  (spec, plan, research, data model, contracts, quickstart, tasks).
- **Changed or rejected:** kept one spec instead of several; moved all infrastructure into
  `infra/`; kept A1 (no re-invite after Decline) after checking the brief.
- **Verified:** spec quality checklist; constitution check in the plan; task format check.

### 2026-11-09 · Phase 1 setup (T001 to T012) · Claude
- **Asked:** repository setup: workspaces, TypeScript, lint, test runners, Compose, env example,
  README and log skeletons.
- **Produced:** root config files, `shared`, `server`, `web`, `e2e` packages, `compose.yaml` and
  `infra/docker/docker-compose.yml`, `.env.example`.
- **Changed or rejected:** pinned ESLint 9 because `eslint-plugin-react` does not support ESLint 10
  yet; pinned `@types/node` 22 to match the runtime; kept React 18 as planned (latest is 19).
- **Verified:** see the Phase 1 checkpoint in the commit message (install, typecheck, lint, tests,
  database healthy).

### 2026-11-09 · Phase 2 foundation (T013 to T041, except T035) · Claude
- **Asked:** schema, roles, seed, reset; shared transition table and counts; server engine (one
  transaction per action), SSE hub, routes, middleware; web live layer, API client, base components.
- **Produced:** `server/db/*.sql`, `server/src/**`, `shared/src/**`, `web/src/**`, 76 tests.
- **Changed or rejected:**
  - The transition decision lives only in `shared/transitions.ts`; the SQL update is guarded by the
    state it was decided from (`WHERE participation = $4 AND attendance = $5`) instead of repeating
    the rules in SQL. One source of truth, the shift lock serializes, the constraints back it up.
  - Tests use a separate `staffing_test` database so they never wipe development data.
  - Added `demoMode` to the snapshot, `assignmentId` to events and an `UNAVAILABLE` (503) error
    code for the live stream; not in the first contract draft.
  - No router library: two paths (`/`, `/worker`) handled with `location.pathname`.
  - T035 not done: the Claude Design project could not be read from this session (its MCP is not
    connected). Tokens come from the design prompt for now.
- **Verified:** 52 shared unit tests (all 42 state and action pairs), 21 server tests on real
  Postgres (constraints, privileges, validation, error format, headers), 3 web unit tests; manual:
  repeat invite keeps the timestamp, SSE stream opens with `retry` then a snapshot, the dashboard
  updated to version 2 without reload after a curl accept, no console errors.

### 2026-11-09 · T035 design import · Claude Design + Claude
- **Asked:** implement the State Sheet from the exported Claude Design project.
- **Produced:** `docs/design/` (exported files + README), design tokens in `web/src/index.css`,
  components: participation pill, attendance chip, buttons with loading states, toasts, connection
  badge, offline banner, KPI pop-in number, app shells for both views. Geist fonts self-hosted.
- **Changed or rejected:** left out the "one worker, one session" picker lock (contradicts the
  spec), "Signed in as" (no login), memoji slots, extra nav items, phone chrome, pronouns in
  messages. Listed in `docs/design/README.md`.
- **Verified:** typecheck, lint, 76 tests, build; in the browser at 1440 px and 375 px: badge Live,
  server stopped → banner + "Offline, data from …", server restarted → back to Live without reload.

### 2026-11-09 · US1 manager dashboard (T042 to T047) · Claude
- **Asked:** invite and SSE tests, shift header, KPI row, worker table, manager page per
  `Dashboard.dc.html`.
- **Produced:** `server/tests/api/invite.test.ts`, `server/tests/api/sse.test.ts`,
  `web/src/components/{ShiftHeader,KpiRow,WorkerTable}.tsx`, updated `Manager.tsx`.
- **Changed or rejected:** the new tests passed on the first run instead of failing first, because
  the generic action engine from Phase 2 already handled invites; I kept them as regression tests.
  Times now use 24-hour format (en-GB) to match the design. Readiness line, timeline and copy-link
  are left for US6 (C4, C5, C8).
- **Verified:** 82 tests passed at that point. In the browser at 1440 px: seed shows Filled 0/3 and
  three Invite buttons; clicking Invite showed "Inviting…" (disabled), then "✓ Invite sent to
  Youssef"; an accept sent with curl updated the row, Filled 1/3 and the bar without reload.

### 2026-11-09 · US5 measurement tooling (T066) · analyser, architect and reviewer agents + Claude
- **Asked:** a repeatable way to measure update delay and reconnection recovery time, with no
  estimated numbers anywhere (constitution principle VI).
- **Produced:** `e2e/measure.ts` and `e2e/measure/*` (one small module per concern), `e2e/stats.ts`,
  `docs/measurements.md` (method, definitions, limitations; results still to be filled from real
  runs), a `measure` service in the e2e compose file, `npm run measure` and `measure:docker`.
- **Method decided with the analyser:** timestamps are `Date.now()` taken inside each page (not around
  Playwright calls); the worker alternates "Cancel my spot" and "Accept again" so no database reset is
  needed between runs; 6 warm-up runs are kept but never counted; failed runs are recorded, never
  dropped. Recovery is timed from restoring the network to the manager showing the new state with a
  Live badge. Chromium does fire the `online` event on `setOffline(false)` (seen in the smoke runs).
- **Reviewer findings fixed:** the SC-005 verdict ignored failed runs (8 timeouts of 20 could still
  read "met"; now a test covers it); any exception threw away every sample (now the samples taken so
  far are written and marked aborted, exit code 1); the server stop had no SIGKILL fallback and did
  not handle closing the terminal; recovery had no negative-time check; a failing `git status` read as
  a clean tree; an observer leaked after a timeout; the docs now state the emulated-network limit.
- **Verified:** 209 unit and API tests (16 of them in e2e: statistics and verdict logic), typecheck,
  lint, local e2e, compose config. Two smoke runs with tiny settings, deleted afterwards and not quoted
  anywhere: a normal one, and one with a temporarily sabotaged recovery run to prove the abort path
  (file restored byte for byte).
- **Official runs (done 2026-11-09):** three host runs and three Docker runs on commit `b876293`, clean
  tree, Mac on AC power. No failed or aborted run. Host: median update delay 21 ms (max 45), median
  recovery 16 ms (max 67). Docker: median update delay 15 ms (max 23), median recovery 20 ms (max 33).
  Raw JSON in `docs/measurements/`, tables and limitations in `docs/measurements.md`. The numbers were
  copied from the JSON by script, not typed by hand. The Mac was not idle (macOS background activity),
  which the doc states.

### 2026-11-09 · Docker image and e2e container (T077, T086) · analyser, architect and reviewer agents + Claude
- **Asked:** a production image that `docker compose up --build` starts from a clean clone, and an
  e2e container so the team receiving the project needs no local Node or browser install.
- **Produced:** a 3-stage `infra/docker/Dockerfile` (compiled JavaScript, not tsx; non-root `node`
  user; healthcheck; read-only filesystem; 268 MB), `.dockerignore`, a separate
  `docker-compose.e2e.yml` (own project, throwaway in-memory database, no ports, no volumes),
  `Dockerfile.e2e` on the official Playwright image, `infra/scripts/e2e-docker.sh`, `infra/README.md`.
- **Changed from the task text:** a separate compose file instead of a profile (a profile cannot set
  its own project name, and would also start the demo database and app on the same ports).
- **Reviewer findings fixed:** `.dockerignore` only excluded `.env` at the repo root; the e2e
  database host was not validated (any host could have been wiped); the e2e script did not clean up
  on Ctrl-C. The e2e target is now strict: in the container both the app and the database must be
  compose service names, and a dev server on localhost is refused.
- **Two real bugs found only because the container test uses a hostname instead of localhost** (a
  plain-http page at any other address is not a "secure context"):
  1. helmet's default `upgrade-insecure-requests` made the browser fetch the page's own script and
     stylesheet over https, so the page stayed blank (ERR_SSL_PROTOCOL_ERROR). Anyone opening the
     app by IP or hostname over http, such as a worker on a phone on the same wifi, would have seen
     nothing. Removed, with a test.
  2. `crypto.randomUUID()` is undefined there, so every action button threw before sending
     anything. New `newRequestId()` falls back to `getRandomValues`, with tests. `navigator.clipboard`
     is also missing there; noted on T075.
  Both reproduced by hand at the LAN address before fixing, and checked by hand after.
- **Also:** request logs are one short line, health checks are not logged (they ran every 15 s with
  every header).
- **Verified:** image builds; first start from an empty volume applies schema, roles and seed once;
  a restart keeps data; `docker stop` is graceful (exit 0); runs as uid 1000 on a read-only
  filesystem with no `.env`, specs or tests inside; QA script 36 of 36 against the container
  including the database outage drill (container restart count 0); e2e container passes twice
  (2 of 2, exit 0, nothing left behind); local e2e still passes; 15 guard cases for the e2e target
  checked with a scratch script; 201 unit and API tests.

### 2026-11-09 · US4 reliable actions and live connection (T057 to T065) · analyser, architect and reviewer agents + Claude
- **Asked:** repeats, retries, concurrency, honest failures, offline indicator and automatic
  catch-up. The analyser found T061 to T064 (banner, badge, mounting, "updated from another
  session") already built; the work was tests, the two Playwright specs, the QA script, and
  reliability fixes.
- **Produced:** concurrency and health API tests, pool tests, retry tests for the API client,
  Playwright specs (live sync across two browser sessions, offline recovery) with their own
  database and port, `infra/scripts/qa-api.sh`, `docs/qa.md` with real results.
- **Bugs found before any user would hit them:**
  - The database pool had no error handler: when the database goes away, Node treats the idle
    connection error as uncaught and kills the server (quickstart scenario 12). Fixed.
  - Reviewer: the first fix (`query_timeout`) could leave a poisoned connection in the pool, and
    errors on checked-out connections were still unhandled. Now a server-side `statement_timeout`,
    a longer client-side backstop that destroys the connection, and an error listener on every
    connection (each error reported once).
  - Reviewer: the new `offline` listener stopped all reconnecting, so a false `offline` event with
    a missed `online` would leave the page Offline until reload. Now the badge is held on Offline
    but a slow 10 s probe keeps trying until a valid snapshot arrives.
  - Reviewer: SSE could write to a response that was already ended (client left or shutdown while
    the first snapshot loaded). Guarded and tested.
- **Found by running, not reading:** the first Playwright run failed because the test compared
  `innerText` with `textContent`. With the `offline` listener removed, the recovery test fails
  (Chromium's offline switch does not close an open EventSource, the badge stays Live), so the
  listener is needed and the test guards it.
- **Reviewer nits fixed:** QA script refuses `QA_RESET=0` and a non-local `BASE_URL`, no longer
  aborts on a failed burst request, exits cleanly on interrupt; e2e refuses a non-local database
  host and no longer honours `BASE_URL`; the health stream test no longer passes vacuously.
- **Decided against:** none. **Added:** task T086 (run e2e in a container for the handover), after
  Ibrahim asked about delivering the project to another team.
- **Verified:** typecheck, lint, 197 unit and API tests (52 shared, 82 server, 63 web), web build,
  both Playwright tests 3 runs in a row (and 5 runs before the last fixes), QA script 34 of 34
  including the database outage drill. Not done: the manual browser rows in `docs/qa.md`.

### 2026-11-09 · US3 check in and check out (T054 to T056) · analyser, architect and reviewer agents + Claude
- **Asked:** a worker checks in and out; check-out is final; Filled does not change. The analyser
  found that the buttons, the final message and the recorded-time rows already existed from US2, so
  US3 became: the API tests (T054), one bug fix, doc corrections, and a browser verification.
- **Produced:** `attendance.test.ts` (19 tests: check in and out, every refusal, repeats, events,
  counts, a parallel check-in and check-out), `stamps.test.ts` (deterministic), a fix in
  `repository.ts` and `schema.sql`.
- **Bug found by the analyser:** stamps used `now()`, the START of the transaction. A check-out that
  began before a check-in but waited behind it for the shift lock could stamp an earlier time than
  the check-in, break the database constraint and return a 500. Stamps, `updated_at` and the event
  time now use `clock_timestamp()`, evaluated after the lock is held. The parallel API test only
  guards this by timing, so the deterministic proof is `stamps.test.ts` (sleeps inside a
  transaction); I confirmed it fails against the old code.
- **Reviewer findings fixed:** `stamps.test.ts` rolled back only on success, so a failing assertion
  left a transaction open, blocked the next test's database reset and caused an unrelated 6 s
  timeout (reproduced by putting `now()` back: now exactly two tests fail and nothing hangs);
  `data-model.md` events row and transaction steps now match `service.ts`.
- **Decided against:** a `GREATEST(clock_timestamp(), checked_in_at)` guard. It would only matter if
  the database clock stepped backwards, and the constraint then fails loudly instead of storing bad
  data. Known limit, not worth the complexity here.
- **Verified:** typecheck, lint, 161 tests (52 shared, 62 server, 47 web), build. Browser: worker
  checked in (Check out only, green dot, three times) and out (grey panel, check circle, "You
  checked out at HH:MM. Thanks!", four times); dashboard shows Filled 1/3, Checked in now 0,
  Checked out 1; check-in or cancel after check-out is a 409 with the current state; a repeated
  check-out returns `changed:false`.

### 2026-11-09 · US2 worker view (T048 to T053) · analyser, architect and reviewer agents + Claude
- **Asked:** the worker picks a name, sees the shift and both statuses, and can accept, decline,
  cancel and accept again, with only the allowed buttons shown. Workflow: analyser writes a brief,
  architect implements, reviewer checks the diff, I test in the browser.
- **Produced:** `respond.test.ts` and `shift-full.test.ts`; `workerParam.ts` (the `?worker=` id and
  history handling); `workerView.ts` (pure: which buttons and message for a state, built from the
  shared transition table); `WorkerSelector`, `WorkerStatus`, `ShiftCard`, `WorkerActions`, the
  worker page; web unit tests for `workerView` and `workerParam`.
- **Changed or rejected:** left out the design's "one worker, one session" lock and "Signed in as"
  (see `docs/design/README.md`). Check in and Check out buttons come with US2 because an accepted
  worker would otherwise have nowhere to go; US3 only adds its tests. `?worker=` holds the worker
  id, not the assignment id, with a unit test that uses different ids (in the seed they match, so
  a mix-up would pass every other test). No default worker: no param shows the picker.
- **Reviewer findings fixed:** a loading button now uses `aria-disabled` (a keyboard user keeps
  focus if the request fails), screen readers no longer hear every change twice, a bad `?worker=`
  no longer steals focus, focus goes to the heading instead of the whole page, the declined message
  has no check icon, `workerView` takes one argument, hex colours became tokens, the status rows
  grow with large text, the dependency line in tasks.md was restored.
- **Left for later:** cancel after check-in (409) gets its API test with US3; no component or
  browser tests yet (Playwright arrives with T059).
- **Verified:** typecheck, lint, 128 tests (52 shared, 41 server, 35 web), build. Browser at 375 px:
  picker, deep links, bad ids removed from the URL, invite arriving live, accept, cancel, accept
  again, repeat accept (`changed:false`), Switch and Back, focus on the heading after a pick, the
  loading button keeps focus.

### 2026-11-09 · US1 fixes · analyser, architect and reviewer agents + Claude
- **Asked:** fix the weak spots I listed in my own US1 code, through three agents: an analyser to
  find issues, an architect to implement, a reviewer to check the diff.
- **Produced:** per-action in-flight tracking (no duplicate requests from fast clicks), a semantic
  `<table>` with sticky name and action columns, a CSS-keyed row highlight instead of an effect and
  two animation frames, `useNow` shared hook, "Today" label refreshed each minute, a client rule
  that picks up a database reset without a reload, guarded snapshot parsing, an error boundary,
  deterministic SSE repeat test, `formatTime`/`formatDay` tests.
- **Changed or rejected:** the reviewer found that the reset rule could briefly show an older
  snapshot over a newer one and contradicted the constitution; I tightened it (the first snapshot
  of a connection must also be built no earlier than the held one), added a race test, amended the
  constitution to 1.0.1 and the live-updates contract. Also from the review: a ping no longer marks
  the connection Live before the first valid snapshot, the reduced-motion border moved onto the
  overlay so it shows on all sides, the in-flight guard uses a ref, focus is kept after any invite
  outcome, `formatTime` never throws, the test helper reports real stream errors. Removed the
  leftover Sync Impact Report comment from the constitution.
- **Found in the browser, missed by both agents:** the highlight overlay was an absolutely
  positioned `<td>`; the browser wrapped it in an anonymous cell, creating a hidden 9th column
  that took half the spare width. Replaced by a `::after` layer on each cell, restarted by
  alternating two keyframe names (no remount, so keyboard focus is kept). Also gave the sticky
  cells `z-10` (scrolled pills painted over the name) and narrowed the name column on phones.
- **Verified:** typecheck, lint, 90 tests, build. Browser at 1440 px: three fast Invite clicks sent
  exactly two invites (version 2, two success toasts, no "already" toast), focus moved to the name
  cell, 8 columns with the name taking the spare width, an outside accept highlighted the whole
  row. At 375 px: name and Invite stay sticky and on top while the middle scrolls.

### 2026-11-09 · US2 design pass: avatar picker, notice, desktop layout · Claude + reviewer agent
- **Asked:** make the worker view match the Claude Design State Sheet, use the supplied avatar
  images, and give non-phone screens a polished layout that keeps the mobile controls.
- **Produced:** the name picker as a tile grid (cut-out portrait on a gradient, initials badge, name
  pill, status line), avatars cropped and resized to 512 px WebP (about 29 KB each instead of 1 MB+
  PNGs) and matched by first name with an initials fallback; the "Updated from another session"
  notice, driven by a live-store flag that tells stream snapshots from this tab's own responses; the
  4 px tighter "Cancel my spot"; a responsive worker page (phone column below `md`, the dashboard's
  dark shell and rounded panel from `md`, side navigation from `lg`, two columns on the worker
  screen); `SideNav` shared with the manager page.
- **Changed or rejected:** the reviewer found no breakage but flagged live regions inserted already
  filled in (now persistent, content toggled), lost focus when another session removes the focused
  button (now a focus-recovery effect, not only after own taps), a header overlap at 768 px (pill
  shrinks below `lg`), an unnamed focus target (now a labelled group), and an over-optimistic
  comment on the local-request window (rewritten). Not changed: reading order of "Recorded times"
  on phones (visual order follows the design).
- **Still deliberately different from the design:** the "In use" session lock and "Signed in as"
  (see docs/design/README.md). The offline banner stays visible on the picker, where the design
  hides all connection chrome.
- **Verified:** typecheck, lint, tests (47 web), build. Browser at 390, 768, 820 and 1440 px: picker,
  worker screen, offline banner, notice appearing on an outside invite and clearing on own Accept.
