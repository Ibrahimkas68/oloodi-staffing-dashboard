# Live Staffing Dashboard Constitution

## Core Principles

### I. Simplicity First

- The system MUST run as one backend service, one PostgreSQL database and one web client.
- The project MUST NOT add an ORM, Redis, a message queue, microservices, an auth system or a
  cache layer unless a written requirement cannot be met without it.
- Any added dependency or component MUST be justified in the plan's Complexity Tracking table.

Rationale: the brief evaluates simplicity and lean implementation. Every extra part adds failure
modes that must be explained in the demo.

### II. The Database Enforces the Rules

- Every business rule (allowed transitions, attendance only for Accepted workers, one assignment per
  worker per shift, timestamp consistency) MUST be enforced by a database constraint or a
  conditional `UPDATE ... WHERE <allowed state> ... RETURNING`, not only in application code.
- Each action MUST run in one transaction: lock the shift row, apply the conditional update, insert
  the event, increment the shift version, commit.
- Counts (filled, remaining, checked in, checked out) MUST be derived from assignments, never stored.

Rationale: concurrent clicks and two sessions must never produce an impossible row or counts that
disagree with the worker list.

### III. Every Transition Is Tested

- The transition table is the single source of truth in code. Every allowed transition MUST have a
  test, and every forbidden pair MUST be rejected by a test generated from that table.
- API and concurrency tests MUST run against a real PostgreSQL instance, not mocks.
- A business rule without a test is not done.

Rationale: correctness of status transitions is the core of the exercise and must be provable.

### IV. The Server Is the Single Source of Truth

- Clients MUST receive a full snapshot on every (re)connect and after every committed change.
- Clients MUST apply a snapshot only when its version is newer than the one they hold. The one
  exception is the first snapshot of a new connection after a database reset, accepted only when it
  was built no earlier than the held snapshot (see contracts/live-updates.md).
- Clients MUST NOT store actions locally or queue them for later replay.

Rationale: a full versioned snapshot removes missed-event bugs and makes catch-up after an outage
automatic.

### V. Safe Repeats

- Every action MUST be idempotent: repeating an action already applied returns `200` with
  `changed: false` and leaves recorded timestamps untouched.
- An action not allowed from the current state MUST return `409` with the current state.
- Repeated clicks or retries MUST NOT create duplicate rows or events.

Rationale: the brief requires that retries never duplicate records, change timestamps or break counts.

### VI. Honest Feedback

- All errors MUST use one format: `{error:{code,message,current},requestId}`.
- The UI MUST NOT show an action as saved unless the server confirmed it. A failed action MUST say
  that nothing was saved.
- The UI MUST show when live updates are unavailable and when they resume.
- Performance claims MUST come from recorded measurements, never estimates.

Rationale: reliability includes telling the user the truth about what happened.

### VII. Owned AI-Assisted Work

- No generated code is committed before it has been read and is covered by a test or a recorded
  manual check.
- Every significant AI step MUST be logged in `AI_LOG.md`: what was asked, what was produced, what
  was changed or rejected, and how it was verified.

Rationale: the brief evaluates ownership of AI-assisted work.

## Technology and Security Constraints

- Stack: TypeScript, Node.js 22, Express 5, PostgreSQL 16, `pg` with plain parameterized SQL, zod,
  pino, native SSE, React 18 with Vite, Tailwind CSS. Changes to this list require an amendment.
- SQL MUST use placeholders (`$1`, `$2`); SQL built from strings is forbidden.
- The running app MUST connect with a least-privilege role: no DDL, no DELETE, events append-only.
- No authentication: a simple worker selector is used, as the brief allows. This MUST be listed as a
  limitation in the README.
- Responses MUST NOT leak stack traces; security headers via `helmet`; POST routes rate limited;
  demo endpoints mounted only when `DEMO_MODE=true`.
- Secrets live only in environment variables; `.env` is never committed.
- The app MUST start from a clean clone with `docker compose up --build`.

## Development Workflow and Quality Gates

- Work follows Spec Kit: one specification for the core feature, then plan, tasks and implementation.
- Each phase ends with a commit in conventional style (`feat:`, `test:`, `fix:`, `docs:`).
- Before a commit: typecheck, lint and tests MUST pass locally.
- CI MUST run typecheck, lint, unit and API tests against PostgreSQL, and a Docker build.
- Before delivery: every P0 requirement ticked against the brief, CI green, clean clone test passed.

## Governance

- This constitution overrides other practices for this repository. Plans MUST pass the
  Constitution Check before implementation and again after design.
- Amendments are written in this file with a version bump and a one-line reason, and recorded in
  `AI_LOG.md` when AI was involved.
- Versioning: MAJOR for removing or redefining a principle, MINOR for adding a principle or section,
  PATCH for wording fixes.
- Any violation that is kept MUST be justified in the plan's Complexity Tracking table.

**Version**: 1.0.1 | **Ratified**: 2026-11-08 | **Last Amended**: 2026-11-09

Amendments:
- 1.0.1 (2026-11-09): Principle IV clarifies the reset exception to the version rule.
