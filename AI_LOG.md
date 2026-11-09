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
