# Data Model: Live Staffing Dashboard

Spec entities: Shift, Worker, Assignment, Activity event (spec "Key Entities").

## Tables

### shifts

| Column | Type | Rules |
|---|---|---|
| id | integer identity | PK |
| title | text | not null, non-empty |
| location | text | not null, non-empty |
| starts_at | timestamptz | not null |
| ends_at | timestamptz | not null, `ends_at > starts_at` |
| required_workers | integer | not null, `> 0` (seed: 3) |
| version | bigint | not null, default 0, incremented by every committed action |

### workers

| Column | Type | Rules |
|---|---|---|
| id | integer identity | PK |
| full_name | text | not null, non-empty |

### assignments

| Column | Type | Rules |
|---|---|---|
| id | integer identity | PK |
| shift_id | integer | FK → shifts, not null |
| worker_id | integer | FK → workers, not null; `UNIQUE (shift_id, worker_id)` |
| participation | text | `uninvited`, `invited`, `accepted`, `declined`, `cancelled` |
| attendance | text | `not_started`, `checked_in`, `checked_out` |
| invited_at | timestamptz | null until invited |
| responded_at | timestamptz | last accept, decline or cancel time (see note) |
| cancelled_at | timestamptz | null unless cancelled at least once |
| checked_in_at | timestamptz | null until check-in |
| checked_out_at | timestamptz | null until check-out; `>= checked_in_at` |
| updated_at | timestamptz | internal, not sent to clients |

Note on `responded_at`: set on Accept, Decline and Cancel. A repeat of the same action never changes
it (the transition table sees the target state and nothing is written). Accept again after Cancel sets a new `responded_at`,
which is a real new response, not a repeat.

### events (append-only)

| Column | Type | Rules |
|---|---|---|
| id | bigint identity | PK |
| shift_id | integer | FK → shifts |
| assignment_id | integer | FK → assignments |
| action | text | `invite`, `accept`, `decline`, `cancel`, `check_in`, `check_out` |
| actor | text | `manager` or `worker` |
| version | bigint | shift version after this action |
| at | timestamptz | set by the app with `clock_timestamp()` (the moment of the write); the column default is only a fallback |

## Constraints (database refuses impossible rows)

- `CHECK participation IN (...)`, `CHECK attendance IN (...)`.
- Attendance only for accepted: `attendance = 'not_started' OR participation = 'accepted'`.
- Timestamp consistency:
  - `invited_at IS NOT NULL` when participation is not `uninvited`.
  - `checked_in_at IS NOT NULL` when attendance is `checked_in` or `checked_out`.
  - `checked_out_at IS NOT NULL` exactly when attendance is `checked_out`.
  - `checked_out_at >= checked_in_at`.
- `UNIQUE (shift_id, worker_id)`; `ends_at > starts_at`; `required_workers > 0`.

## State transitions

Participation: `uninvited → invited → accepted | declined`; `accepted (not_started) → cancelled`;
`cancelled → accepted`. Declined has no outgoing transition (A1, A2).
Attendance (only while accepted): `not_started → checked_in → checked_out` (final).

| Action | Actor | Allowed when | Sets | Target (repeat detection) |
|---|---|---|---|---|
| invite | manager | participation = uninvited | participation=invited, invited_at=now | participation = invited |
| accept | worker | participation in (invited, cancelled) and filled < required | participation=accepted, responded_at=now | participation = accepted |
| decline | worker | participation = invited | participation=declined, responded_at=now | participation = declined |
| cancel | worker | participation = accepted and attendance = not_started | participation=cancelled, responded_at=now, cancelled_at=now | participation = cancelled |
| check_in | worker | participation = accepted and attendance = not_started | attendance=checked_in, checked_in_at=now | attendance = checked_in* |
| check_out | worker | attendance = checked_in | attendance=checked_out, checked_out_at=now | attendance = checked_out |

\* A check-in sent after check-out is reported as `409` ("already checked out"), not as a repeat,
because the worker is no longer checked in. Only `attendance = checked_in` counts as the check-in
target for the `changed:false` rule.

## Transaction per action

1. `BEGIN`
2. Find the assignment's shift; no such assignment gives `404 NOT_FOUND`
3. `SELECT ... FROM shifts WHERE id = $1 FOR UPDATE` (every change to the shift runs one at a time)
4. Read the assignment state, then let the shared transition table decide (research R4): already in
   the target state gives `200 changed:false` and nothing is written; not allowed gives
   `409 INVALID_TRANSITION` with the current state.
5. For accept: count accepted assignments; if `>= required_workers` then `409 SHIFT_FULL`
6. Guarded `UPDATE assignments SET ... WHERE id = $1 AND participation = <read> AND attendance = <read>`.
   Zero rows is a fallback that cannot happen while the lock is held; it is reported as an internal error.
7. `UPDATE shifts SET version = version + 1 RETURNING version` (each applied action bumps the version by
   exactly one; refused and repeated actions do not)
8. `INSERT INTO events (...)` with that version
9. Read the snapshot (still inside the transaction, so it is consistent) and `COMMIT`
10. After the commit, and only when something changed, broadcast that snapshot to every live client

Stamps (`invited_at`, `responded_at`, `cancelled_at`, `checked_in_at`, `checked_out_at`), `updated_at`
and `events.at` use `clock_timestamp()` (the moment of the write), not `now()` (the start of the
transaction). A request can wait on the lock after its transaction began, and a transaction-start time
could then be older than a time another request committed meanwhile, which would put a check-out before
its check-in.

## Derived counts (never stored)

- filled = assignments with participation = accepted (includes checked in and checked out)
- remaining = required_workers − filled
- checkedIn = attendance = checked_in; checkedOut = attendance = checked_out
- invited, declined, cancelled, uninvited = counts by participation

## Roles

| Role | Grants |
|---|---|
| staffing_owner | owns schema; runs schema, roles, seed, reset |
| staffing_app | SELECT, UPDATE on shifts and assignments; SELECT, INSERT on events; SELECT on workers; no DELETE, no DDL |

## Seed

1 shift "Rabat Tech Summit · Hall Setup", "Main Hall, Rabat", today, starting 2 hours after reset,
6 hours long, required 3. Workers Amina El Idrissi, Youssef Benali, Salma Haddad. 3 assignments,
`uninvited` and `not_started`. Version 0, no events.
