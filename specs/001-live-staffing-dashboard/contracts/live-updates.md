# Contract: Live updates (Server-Sent Events)

`GET /api/events`, `Content-Type: text/event-stream`, `Cache-Control: no-store`,
`Connection: keep-alive`. In production behind a proxy, response buffering must be off.

## Server behaviour

1. Register the client in the hub (reject with `503` above the client cap).
2. Send `retry: 2000`.
3. Send `event: snapshot` with the current [Snapshot](snapshot.md). Registering before reading means
   no commit can fall between the read and the subscription.
4. After every committed action, send `event: snapshot` to every client.
5. Every 15 s send `event: ping` with `data: {"serverTime": "<ISO>"}`. A named event, because SSE
   comment lines are invisible to `EventSource`.
6. On disconnect, remove the client. On shutdown, close all streams.

## Events

| Event | Data | When |
|---|---|---|
| `snapshot` | Snapshot JSON | on connect, after every commit |
| `ping` | `{ "serverTime": string }` | every 15 s |

Ordering: snapshots carry `version`; versions increase strictly with commits (shift row lock).

## Client behaviour

- Status: `live` after the first snapshot; `reconnecting` on error while `EventSource` retries;
  `offline` once the stream is closed for good or retries keep failing; show `lastSyncedAt`.
- Version guard: apply a snapshot only if `version > current.version` (also for HTTP responses).
  Exception: the first snapshot of a new connection is also applied when its `serverTime` is not
  earlier than the held snapshot's, so a database reset (version back to 0) is picked up without a
  reload, while an older snapshot that raced a commit is still ignored.
- A `ping` before the first valid snapshot only re-arms the watchdog; the status turns `live` on
  the first valid snapshot.
- Watchdog: no `snapshot` or `ping` for 35 s → close and reconnect.
- Closed stream (error status such as 503): reconnect manually with backoff 1 s, 2 s, 4 s, max 10 s.
- Browser `offline` event: show `offline` at once and close the stream, but keep probing quietly
  every 10 s. The event is only a hint (VPN switches, captive portals and sleep/wake can report it
  while the network works, or miss the matching `online`), so recovery must not depend on it. The
  badge stays `offline` while probes fail; the first valid snapshot makes it `live` again.
- Browser `online` event: reconnect immediately, reset the backoff, show `reconnecting` until a
  valid snapshot arrives.
- Catch-up: the first event of every connection is a full snapshot; no replay of missed events.

## Known limits

- No delivery guarantee; heartbeat and watchdog bound staleness to about 35 s in the worst case.
- One process holds the hub; multiple instances would need PostgreSQL `LISTEN/NOTIFY`.
- About 6 HTTP/1.1 connections per site per browser.
