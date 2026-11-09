# Contract: REST API

Base path `/api`. JSON only. Every response has `Cache-Control: no-store` and echoes `X-Request-Id`
(taken from the request or generated).

## Endpoints

| Method | Path | Actor | Success | Errors |
|---|---|---|---|---|
| GET | `/api/state` | both | `200` [Snapshot](snapshot.md) | `500` |
| GET | `/api/events` | both | `200` SSE stream, see [live-updates.md](live-updates.md) | `503` when the client cap is reached or during a simulated outage |
| POST | `/api/assignments/:id/invite` | manager | `200` ActionResult | 400, 404, 409, 429, 500 |
| POST | `/api/assignments/:id/accept` | worker | `200` ActionResult | 400, 404, 409 (`INVALID_TRANSITION`, `SHIFT_FULL`), 429, 500 |
| POST | `/api/assignments/:id/decline` | worker | `200` ActionResult | 400, 404, 409, 429, 500 |
| POST | `/api/assignments/:id/cancel` | worker | `200` ActionResult | 400, 404, 409, 429, 500 |
| POST | `/api/assignments/:id/check-in` | worker | `200` ActionResult | 400, 404, 409, 429, 500 |
| POST | `/api/assignments/:id/check-out` | worker | `200` ActionResult | 400, 404, 409, 429, 500 |
| GET | `/api/health` | ops | `200 {"status":"ok","db":"ok"}` | `503 {"status":"degraded","db":"down"}` |
| POST | `/api/demo/burst` | demo | `200 {"sent":10,"changed":1}` | `404` when `DEMO_MODE` is off |
| POST | `/api/demo/outage?seconds=5` | demo | `202` | `400` (seconds outside 1 to 30), `404` when off |

Unknown action segments return `404 NOT_FOUND`. Request bodies are ignored; body limit 10 kb.

## Path parameter

`id`: positive integer (zod). Anything else (`abc`, `-1`, `1; DROP TABLE workers`) → `400
VALIDATION_ERROR`. A valid id that does not exist → `404 NOT_FOUND`.

## ActionResult (200)

```json
{ "changed": true, "snapshot": { "...": "Snapshot" } }
```

`changed: false` means the assignment was already in the action's target state; nothing was written
and recorded times are unchanged. The snapshot is still returned.

## Decision rule

1. Invalid id → 400.
2. Assignment not found → 404.
3. Accept while not already accepted and filled ≥ required → 409 `SHIFT_FULL`.
4. Allowed from current state → apply, 200 `changed:true`.
5. Already in target state → 200 `changed:false`.
6. Otherwise → 409 `INVALID_TRANSITION` with the current state.

## Error format (all non-2xx)

```json
{
  "error": {
    "code": "INVALID_TRANSITION",
    "message": "Cannot check in: this worker has already checked out.",
    "current": { "participation": "accepted", "attendance": "checked_out" }
  },
  "requestId": "b1f3..."
}
```

| Code | HTTP | `current` |
|---|---|---|
| `VALIDATION_ERROR` | 400 | absent |
| `NOT_FOUND` | 404 | absent |
| `INVALID_TRANSITION` | 409 | present |
| `SHIFT_FULL` | 409 | present, plus `filled` and `required` |
| `RATE_LIMITED` | 429 | absent |
| `INTERNAL` | 500 | absent; no stack trace, details only in logs |

## Client rules

- Timeout 8 s; retry up to 2 times (300 ms, 1 s) only on network errors and 5xx; never on 4xx.
- Apply the returned snapshot only if its version is newer than the one held.
- Never store an action for later.
