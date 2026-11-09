-- Live Staffing Dashboard schema.
-- Every business rule that can be expressed on a single row is enforced here, so the database
-- refuses impossible states even if application code has a bug.

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

CREATE TABLE shifts (
  id               integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title            text        NOT NULL CHECK (length(trim(title)) > 0),
  location         text        NOT NULL CHECK (length(trim(location)) > 0),
  starts_at        timestamptz NOT NULL,
  ends_at          timestamptz NOT NULL,
  required_workers integer     NOT NULL CHECK (required_workers > 0),
  version          bigint      NOT NULL DEFAULT 0,
  CONSTRAINT shift_ends_after_start CHECK (ends_at > starts_at)
);

CREATE TABLE workers (
  id        integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name text NOT NULL CHECK (length(trim(full_name)) > 0)
);

CREATE TABLE assignments (
  id             integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shift_id       integer     NOT NULL REFERENCES shifts (id),
  worker_id      integer     NOT NULL REFERENCES workers (id),
  participation  text        NOT NULL DEFAULT 'uninvited'
    CHECK (participation IN ('uninvited', 'invited', 'accepted', 'declined', 'cancelled')),
  attendance     text        NOT NULL DEFAULT 'not_started'
    CHECK (attendance IN ('not_started', 'checked_in', 'checked_out')),
  invited_at     timestamptz,
  responded_at   timestamptz,
  cancelled_at   timestamptz,
  checked_in_at  timestamptz,
  checked_out_at timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT one_assignment_per_worker UNIQUE (shift_id, worker_id),
  -- Attendance only exists for accepted workers (participation stays Accepted during attendance).
  CONSTRAINT attendance_requires_accepted
    CHECK (attendance = 'not_started' OR participation = 'accepted'),
  -- Timestamps must match the statuses.
  CONSTRAINT invited_at_matches
    CHECK ((participation = 'uninvited') = (invited_at IS NULL)),
  CONSTRAINT responded_at_matches
    CHECK (participation NOT IN ('accepted', 'declined', 'cancelled') OR responded_at IS NOT NULL),
  CONSTRAINT cancelled_at_matches
    CHECK (participation <> 'cancelled' OR cancelled_at IS NOT NULL),
  CONSTRAINT checked_in_at_matches
    CHECK ((attendance IN ('checked_in', 'checked_out')) = (checked_in_at IS NOT NULL)),
  CONSTRAINT checked_out_at_matches
    CHECK ((attendance = 'checked_out') = (checked_out_at IS NOT NULL)),
  CONSTRAINT checked_out_after_checked_in
    CHECK (checked_out_at IS NULL OR checked_out_at >= checked_in_at)
);

-- Append-only history of applied actions (append-only is enforced by role grants, see roles.sql).
CREATE TABLE events (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shift_id      integer     NOT NULL REFERENCES shifts (id),
  assignment_id integer     NOT NULL REFERENCES assignments (id),
  action        text        NOT NULL
    CHECK (action IN ('invite', 'accept', 'decline', 'cancel', 'check_in', 'check_out')),
  actor         text        NOT NULL CHECK (actor IN ('manager', 'worker')),
  version       bigint      NOT NULL,
  at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT one_event_per_version UNIQUE (shift_id, version)
);

CREATE INDEX events_shift_recent ON events (shift_id, id DESC);
