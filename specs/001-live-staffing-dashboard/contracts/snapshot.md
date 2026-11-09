# Contract: Snapshot

The single shape every client receives (HTTP `GET /api/state`, every ActionResult, every SSE
`snapshot` event). Defined once as a zod schema in `shared/` and mapped from DB rows by one function
(`toSnapshot`). camelCase keys, ISO 8601 timestamps, `null` for times not recorded yet.

```ts
type Participation = 'uninvited' | 'invited' | 'accepted' | 'declined' | 'cancelled';
type Attendance = 'not_started' | 'checked_in' | 'checked_out';

type Snapshot = {
  version: number;                 // shift version, increases with every commit
  serverTime: string;              // when this snapshot was built
  demoMode: boolean;               // true when demo controls (burst, outage) are enabled (DEMO_MODE)
  shift: {
    id: number; title: string; location: string;
    startsAt: string; endsAt: string; requiredWorkers: number;
  };
  assignments: Array<{
    id: number;
    worker: { id: number; fullName: string };
    participation: Participation;
    attendance: Attendance;
    invitedAt: string | null;
    respondedAt: string | null;
    cancelledAt: string | null;
    checkedInAt: string | null;
    checkedOutAt: string | null;
  }>;
  counts: {                        // derived, never stored
    filled: number; remaining: number; checkedIn: number; checkedOut: number;
    invited: number; declined: number; cancelled: number; uninvited: number;
  };
  recentEvents: Array<{            // newest first, last 20
    id: number; action: string; actor: 'manager' | 'worker';
    assignmentId: number; workerName: string; at: string; version: number;
  }>;
};
```

Invariants (tested): `filled + remaining = requiredWorkers`; every count equals the count computed
from `assignments`; `recentEvents[0].version = version` when any event exists.

Not sent: `updated_at` and other internal columns.
