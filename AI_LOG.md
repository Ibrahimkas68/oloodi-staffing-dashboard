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
