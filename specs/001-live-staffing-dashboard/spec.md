# Feature Specification: Live Staffing Dashboard

**Feature Branch**: `001-live-staffing-dashboard`

**Created**: 2026-11-08

**Status**: Draft

**Input**: User description: "Live Staffing Dashboard (one core spec). An event manager needs 3 workers for one shift. Worker view and manager dashboard in separate browser sessions, consistent through one shared backend and database. Two status dimensions (Participation, Attendance), live updates without refresh, safe repeats and retries, offline indicator with automatic catch-up, measurements of update delay and recovery time, and optional creative extras."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manager invites workers and watches staffing live (Priority: P1)

The event manager opens the dashboard and sees one shift: its title, date, start and end time,
location and the number of workers required (3). Below it, each of the three workers is listed with
their participation status, attendance status and the times they were invited, responded, checked in
and checked out. The manager sends an invitation to any worker who has not been invited yet. Filled
places, remaining places, and the number of workers currently checked in and checked out are shown
and always agree with the list. When a worker responds or checks in from another session, the
dashboard updates on its own, without a refresh.

**Why this priority**: The manager dashboard is the reason the product exists: seeing staffing as it
changes. Invitations are the entry point of every other flow.

**Independent Test**: With the seed data, open the dashboard, invite one worker, and confirm the
worker's row changes to Invited with an invitation time, and that counts are unchanged (invited is
not filled). Then change that worker's state from a second session and confirm the dashboard shows it
without a refresh.

**Acceptance Scenarios**:

1. **Given** the seed state (all three workers Uninvited, Not started), **When** the manager opens the
   dashboard, **Then** shift details are shown, every worker is Uninvited and Not started, Filled is
   0 of 3, Remaining is 3, Checked in is 0 and Checked out is 0.
2. **Given** a worker is Uninvited, **When** the manager invites them, **Then** the worker becomes
   Invited, the invitation time is recorded and shown, and the invite action is no longer offered for
   that worker.
3. **Given** the dashboard is open, **When** a worker accepts, declines, cancels, checks in or checks
   out from another browser session, **Then** the dashboard shows the new status, timestamps and
   counts without the manager refreshing.
4. **Given** any combination of worker states, **When** the manager reads the counts, **Then** Filled
   equals the number of Accepted workers (including those Checked in or Checked out), Remaining equals
   required places minus Filled, and Checked in and Checked out match the list.

---

### User Story 2 - Worker responds to an invitation (Priority: P1)

A worker opens the worker view and picks their name from a simple selector (no login). They see the
shift details and their own status. If invited, they can accept or decline. If accepted and not yet
checked in, they can cancel. If cancelled, they can accept again. Only the actions allowed in the
current state are offered.

**Why this priority**: Without worker responses there is nothing to staff. Accept, decline, cancel
and accept again are explicit rules in the brief.

**Independent Test**: With one invited worker, select them in the worker view, accept, cancel, accept
again; confirm each status and response time is saved, survives a refresh, and that counts move
between Filled 0 and Filled 1 accordingly.

**Acceptance Scenarios**:

1. **Given** a worker is Uninvited, **When** they open the worker view, **Then** they see "no
   invitation yet" and no actions.
2. **Given** a worker is Invited, **When** they accept, **Then** participation becomes Accepted, the
   response time is recorded, and Filled increases by 1.
3. **Given** a worker is Invited, **When** they decline, **Then** participation becomes Declined, the
   response time is recorded, and no further participation actions are offered.
4. **Given** a worker is Accepted and Not started, **When** they cancel, **Then** participation
   becomes Cancelled and Filled decreases by 1.
5. **Given** a worker is Cancelled, **When** they accept again, **Then** participation becomes
   Accepted and Filled increases by 1.
6. **Given** all required places are filled, **When** another worker tries to accept, **Then** the
   action is refused with a message that the shift is full, and nothing changes.

---

### User Story 3 - Worker checks in and checks out (Priority: P1)

An accepted worker arrives and checks in, then checks out when they finish. Check-out is final for
the shift. Participation stays Accepted throughout.

**Why this priority**: Attendance is the second status dimension the brief requires, and the
dashboard counts depend on it.

**Independent Test**: With one accepted worker, check in then check out; confirm both times are
recorded, participation stays Accepted, Filled is unchanged, and no further actions are offered.

**Acceptance Scenarios**:

1. **Given** a worker is Accepted and Not started, **When** they check in, **Then** attendance becomes
   Checked in, the check-in time is recorded, participation stays Accepted, and Checked in increases
   by 1.
2. **Given** a worker is Checked in, **When** they check out, **Then** attendance becomes Checked out,
   the check-out time is recorded, Checked in decreases by 1, Checked out increases by 1, and Filled
   is unchanged.
3. **Given** a worker is Checked out, **When** they view their shift, **Then** no actions are offered
   and a final message with the check-out time is shown.
4. **Given** a worker is Checked in, **When** a cancel is attempted, **Then** it is refused because
   cancelling is only allowed before check-in.
5. **Given** a worker is not Accepted (Uninvited, Invited, Declined or Cancelled), **When** a check-in
   is attempted, **Then** it is refused with a clear reason and nothing changes.

---

### User Story 4 - Reliable actions and live connection (Priority: P1)

Users on unreliable connections, or who click twice, never corrupt the data. Every change is saved and
validated by the shared backend. Refreshing keeps all statuses and times. Repeating an action that
already happened does not change anything. When an action fails, the user is told what happened and
that nothing was saved. When live updates are interrupted, every screen says so, and when the
connection returns the screen catches up on its own.

**Why this priority**: The brief evaluates reliability directly and will likely test it live.

**Independent Test**: Click check-in many times quickly, refresh, cut the network and restore it, and
confirm one recorded check-in time, correct counts, a visible offline indicator during the outage, and
an automatic return to current data afterwards.

**Acceptance Scenarios**:

1. **Given** any state, **When** the user refreshes either view, **Then** all statuses and recorded
   times are identical to before the refresh.
2. **Given** a worker is already Checked in, **When** check-in is sent again (double click or retry),
   **Then** the response confirms the worker is already checked in, the original check-in time is
   kept, and no duplicate record is created.
3. **Given** an action is not allowed in the current state, **When** it is attempted, **Then** the
   user sees a specific message explaining why and the current state, and nothing changes.
4. **Given** the server cannot be reached, **When** the user attempts an action, **Then** the user is
   told the action could not be completed and nothing was saved; the action is not stored for later.
5. **Given** live updates are interrupted, **When** the user looks at either view, **Then** an
   indicator shows that live updates are unavailable and since when the data dates.
6. **Given** changes happened while a view was disconnected, **When** connectivity returns, **Then**
   the view shows the current state automatically, without a refresh.
7. **Given** two sessions are open for the same worker, **When** one session acts, **Then** the other
   session shows the change; if both act at once, exactly one change is applied and the other session
   receives a clear result.

---

### User Story 5 - Measured update delay and recovery time (Priority: P2)

The developer measures how long a worker's action takes to appear on the manager dashboard, and how
long a view takes to show current data after connectivity returns, and reports the results.

**Why this priority**: The brief asks for simple measurements with a brief explanation. It depends on
stories 1 to 4 working.

**Independent Test**: Run the measurement procedure repeatedly (at least 20 runs each) and confirm it
reports median and maximum update delay and recovery time, with the environment they were taken in.

**Acceptance Scenarios**:

1. **Given** a manager view and a worker view are open, **When** the worker acts, **Then** the time
   from the action to the dashboard showing it is recorded.
2. **Given** a view loses its live connection and changes happen meanwhile, **When** connectivity
   returns, **Then** the time until the view shows the correct current state is recorded.
3. **Given** at least 20 runs of each, **When** results are reported, **Then** median and maximum are
   given together with the machine and browser used.

---

### User Story 6 - Creative extras for clarity and demonstration (Priority: P3)

Optional features that make the core easier to understand and to demonstrate, each removable without
affecting stories 1 to 5:

- A live connection badge showing Live, Reconnecting or Offline with the last sync time.
- Demo controls (only in demo mode) to send a burst of identical actions and to simulate a short
  outage.
- A live metrics panel showing the latest update delay, last recovery time and data version.
- An activity timeline of recent actions, newest first.
- A plain-language readiness line (for example "2 of 3 places filled, Salma accepted, not checked in
  yet").
- A worker view designed for phones first.
- A notice "Updated from another session" when the selected worker's state changes because of
  another session.
- A shareable link that opens the worker view with a given worker selected.

**Why this priority**: The brief welcomes creativity but asks to keep the core reliable and easy to
demonstrate. These come after the core.

**Independent Test**: Each extra can be checked on its own (for example, simulate an outage and watch
the badge change from Live to Reconnecting to Live).

**Acceptance Scenarios**:

1. **Given** demo mode is on, **When** a burst of 10 identical check-ins is sent, **Then** exactly one
   check-in is recorded and the timeline shows one entry.
2. **Given** demo mode is on, **When** a 5-second outage is simulated, **Then** the badge shows
   Reconnecting or Offline during it and Live afterwards, with current data.
3. **Given** demo mode is off, **When** anyone tries to use demo controls, **Then** they are not
   available.
4. **Given** a worker link is opened, **When** the worker view loads, **Then** that worker is selected;
   an unknown worker in the link falls back to the selector with no error page.

---

### Edge Cases

- A declined worker cannot be invited again and cannot accept later (assumption A1, A2).
- An invited worker who never responds stays Invited; the manager cannot withdraw the invitation (A4).
- Accepting when all required places are filled is refused (A6). With 3 workers and 3 places this
  cannot happen in the seed, but the rule holds if capacity changes.
- A checked-out worker counts as Filled and can do nothing more.
- Cancel and check-in sent at the same moment for the same worker: exactly one wins; the other gets a
  clear result based on the new state.
- Ten identical actions at the same moment: one change, one recorded time, one activity entry.
- An action whose response is lost after it was saved: the retry reports "already done" with the
  original time, not an error.
- The backend's data store is unavailable: actions fail with a clear message, the health status shows
  the problem, and the app recovers when the store is back.
- Many open tabs on the same site may limit live connections; the demo uses separate browser windows
  or profiles.
- An unknown worker or assignment identifier is refused with a "not found" or "invalid" message,
  never a crash.

## Requirements *(mandatory)*

### Functional Requirements

**Data and setup**

- **FR-001**: System MUST provide one shift with a title, date, start time, end time, location and a
  required number of workers (3).
- **FR-002**: System MUST provide three named workers, each with exactly one assignment to the shift,
  initially Uninvited and Not started.
- **FR-003**: System MUST offer a reset that restores the seed state, with the shift set to today and
  starting 2 hours after the reset.

**Status rules**

- **FR-004**: System MUST track two independent statuses per assignment: Participation (Uninvited,
  Invited, Accepted, Declined, Cancelled) and Attendance (Not started, Checked in, Checked out).
- **FR-005**: System MUST allow only these transitions:
  | Action | Actor | From | To |
  |---|---|---|---|
  | Invite | Manager | Uninvited | Invited |
  | Accept | Worker | Invited or Cancelled | Accepted |
  | Decline | Worker | Invited | Declined |
  | Cancel | Worker | Accepted and Not started | Cancelled |
  | Check in | Worker | Accepted and Not started | Checked in (participation stays Accepted) |
  | Check out | Worker | Checked in | Checked out (final) |
- **FR-006**: System MUST refuse any other action with a message that names the current state, and
  MUST leave data unchanged.
- **FR-007**: System MUST refuse an Accept that would exceed the required number of workers, with a
  "shift full" message.
- **FR-008**: System MUST record the time of invitation, response (accept, decline, cancel), check-in
  and check-out, and MUST never overwrite a recorded time when an action is repeated.

**Counts**

- **FR-009**: System MUST compute Filled as the number of Accepted assignments, including those
  Checked in or Checked out; Remaining as required minus Filled; Checked in now and Checked out as
  counts of the attendance statuses.
- **FR-010**: Counts MUST always be derived from the current assignments so they cannot disagree with
  the worker list.

**Views**

- **FR-011**: Worker view MUST let the user pick a worker from a simple selector without logging in.
- **FR-012**: Worker view MUST show shift details, the worker's two statuses, recorded times, and only
  the actions allowed in the current state.
- **FR-013**: Manager dashboard MUST show shift details, every worker's two statuses and four recorded
  times, Filled, Remaining, Checked in now and Checked out, and an Invite action for Uninvited workers.
- **FR-014**: Both views MUST show status as text, not colour alone.

**Persistence and consistency**

- **FR-015**: Every change MUST be validated and saved by the shared backend before being shown as
  done; refreshing either view MUST show the saved state.
- **FR-016**: Concurrent actions on the same shift MUST be applied one at a time, so the result is
  always a state reachable through allowed transitions.

**Repeats, retries and feedback**

- **FR-017**: Repeating an action already applied MUST succeed without changes, report that nothing
  changed, and keep the original recorded time.
- **FR-018**: Repeated clicks or retries MUST NOT create duplicate records or activity entries.
- **FR-019**: While an action is in progress, its control MUST be disabled to prevent double
  submission.
- **FR-020**: On a network failure or server error, the client MAY retry a limited number of times;
  if it still fails, the user MUST be told that nothing was saved. Refused actions (not allowed, not
  found, invalid) MUST NOT be retried.
- **FR-021**: Every failure MUST show a specific, human-readable message; internal error details MUST
  NOT be shown to users.
- **FR-022**: Actions attempted while offline MUST NOT be stored for later replay.

**Live updates**

- **FR-023**: Any saved change MUST appear in every open view (manager and worker sessions) without a
  refresh.
- **FR-024**: Every view MUST show when live updates are unavailable, and the time of the last
  successful sync.
- **FR-025**: When connectivity returns, every view MUST automatically show the complete current state,
  including changes made while it was disconnected.
- **FR-026**: A view MUST never replace newer data with older data.

**Measurement and operations**

- **FR-027**: The project MUST include a repeatable procedure that measures update delay (action to
  manager view) and reconnection recovery time, reporting median and maximum.
- **FR-028**: System MUST expose a health status that reports whether the backend and its data store
  are available.
- **FR-029**: Demonstration controls (burst, outage) MUST only be available when demo mode is
  explicitly enabled.

**Creative extras (P3, optional)**

- **FR-030**: System SHOULD provide the extras listed in User Story 6; each MUST be removable without
  affecting FR-001 to FR-029.

### Key Entities

- **Shift**: the single event to staff. Title, date, start and end time, location, required number of
  workers, and a version that increases with every saved change.
- **Worker**: a named person who can be assigned. Full name.
- **Assignment**: the link between one worker and the shift. Participation status, attendance status,
  and the times invited, responded, cancelled, checked in and checked out. One per worker per shift.
- **Activity event**: an append-only record of each applied action: which action, which worker, who
  performed it (manager or worker), when, and the shift version after it. Used for the timeline and
  for auditing; never edited or deleted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of tested sequences, counts shown on the dashboard match the worker list.
- **SC-002**: 10 identical actions sent at the same moment result in exactly 1 change, 1 recorded time
  and 1 activity entry.
- **SC-003**: After a refresh, 100% of statuses and recorded times are unchanged.
- **SC-004**: Every forbidden action in the transition rules is refused, and every allowed one
  succeeds, as shown by automated tests covering each pair.
- **SC-005**: A worker's action appears on an open manager dashboard without a refresh; the median
  update delay over 20 runs is under 1 second on a local setup (target, to be confirmed by
  measurement).
- **SC-006**: After connectivity returns, a view shows the correct current state within 15 seconds in
  every run, without user action (target, to be confirmed by measurement).
- **SC-007**: During an outage, the "live updates unavailable" indicator appears on every open view.
- **SC-008**: A reviewer can start the project from a clean copy and reach the working dashboard by
  following the setup instructions only.
- **SC-009**: The core demo (invite, accept, check in, check out, watched live) can be completed in
  under 4 minutes.

## Assumptions

- **A1**: The manager cannot re-invite a Declined worker. The brief defines no transition out of
  Declined; the only "again" in the brief applies to Cancelled.
- **A2**: A Declined worker cannot change their mind and accept.
- **A3**: The worker is the one who cancels ("An Accepted worker may cancel").
- **A4**: The manager cannot withdraw an invitation.
- **A5**: A Cancelled worker accepts again directly; no new invitation is needed.
- **A6**: Accepting beyond required places is refused ("shift full").
- **A7**: Repeating an applied action succeeds without changes and keeps timestamps.
- **A8**: Offline actions fail clearly and are not queued.
- **A9**: Check-in is allowed at any time; the brief sets no time window.
- **A10**: Reset puts the shift today, starting 2 hours after the reset, so the demo is realistic.
- Out of scope: authentication (the brief says a simple selector is enough; anyone with access can act
  as any worker, listed as a known limitation), multiple shifts, offline action queue, public hosting
  (the project is built ready to deploy, hosting is optional).
- Users have a modern desktop or mobile browser.
- **Visual reference**: the screens and states follow the Claude Design project "Shiftboard"
  (<https://claude.ai/design/p/fd41112f-11b1-4f30-a591-359c608016bd?file=State+Sheet.dc.html>, main
  file `State Sheet.dc.html`). The design guides look and states only; where it shows a status,
  action or screen this spec does not define, this spec wins.
- Measurement targets in SC-005 and SC-006 are goals; reported numbers come only from actual runs.
