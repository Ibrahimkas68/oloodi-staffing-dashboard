# Oloodi Coding Test: Decisions log

> **Planning note, written before the implementation (2026-11-08).** This is the author's own
> research and decision record, copied here unchanged apart from its links. The built system is
> described by the [README](../../README.md) and the [specification](../../specs/001-live-staffing-dashboard);
> where a detail differs, those and the code are current. The task list this note refers to is
> [tasks.md](../../specs/001-live-staffing-dashboard/tasks.md).

Every question I asked or point I clarified while preparing the challenge, the answer, and the final decision.
Spec: [the cahier des charges](cahier-des-charges.md) · Tracker: the task tracker (now [tasks.md](../../specs/001-live-staffing-dashboard/tasks.md))

**How to use:** add a new entry at the bottom for every new question. Keep the answer short; the details live in the cahier section linked in "Where".
**Source tags:** **[BRIEF]** = written in the PDF · **[DECISION]** = my choice · **[ASSUMPTION]** = gap in the brief I filled.

---

## Summary

| # | Date | Topic | Final decision | Where |
|---|---|---|---|---|
| D1 | 2026-11-08 | Stack | TypeScript, Node 22 + Express 5, PostgreSQL 16, `pg` + plain SQL, zod, SSE, React + Vite | Cahier §5 |
| D2 | 2026-11-08 | NestJS vs Express | Express | Cahier §5 |
| D3 | 2026-11-08 | Auth | None (login not required) | Cahier §3, ADR6 |
| D4 | 2026-11-08 | Styling and UI components | Tailwind + Motion + 5 copied beUI components | Cahier §5, ADR9 |
| D5 | 2026-11-08 | Where the task list lives | One list, in the tracker note | Cahier §22 |
| D6 | 2026-11-08 | Mobbin for design inspiration | Not used (MCP needs a paid plan) | Tracker, Design references |
| D7 | 2026-11-08 | Can the manager re-invite a Declined worker? | No (A1 kept) | Cahier §4.6 |
| D8 | 2026-11-08 | What happens to actions when the connection drops? | Nothing saved locally; retry then fail clearly; full snapshot on reconnect | Cahier §11.1, §10 |
| D9 | 2026-11-08 | OpenAPI | Generated from the zod schemas, P2; shared types now | Cahier §8.6, ADR10 |
| D10 | 2026-11-08 | SQL injection | Parameterized queries; zod and DB roles as extra layers | Cahier §8.5 |
| D11 | 2026-11-08 | XSS | React escaping, no `dangerouslySetInnerHTML`, `helmet` CSP | Cahier §8.5 |
| D12 | 2026-11-08 | Other security (CSRF, abuse, leaks, deps) | Same origin, rate limit, SSE cap, no stack traces, `npm audit` | Cahier §8.5 |
| D13 | 2026-11-08 | DTOs | zod schema + TS type is the DTO; one mapper from rows to snapshot | Cahier §9 |

---

## D1. Which stack?

**Question:** What is the simplest stack that fits this small project, without heavy or overpowered tools, but clean and able to grow?

**Answer:** One language end to end (TypeScript) so the snapshot type, transition table and `deriveCounts` are shared. Express for 6 action routes, PostgreSQL for constraints, transactions and row locks, plain SQL so the safety logic stays visible, native SSE for one-way updates. No ORM, no Redis, no queue, no microservices.

**Decision:** **[DECISION]** Stack as in cahier §5. SQLite only as a fallback if Docker fails.

## D2. NestJS or Express?

**Question:** Is NestJS better for this kind of project?

**Answer:** NestJS is good for large teams and many modules (DI, decorators, modules). Here there are about 10 routes and one domain; NestJS would add structure to explain without solving a real problem. Express keeps the request path short and readable in a code walk.

**Decision:** **[DECISION]** Express 5. NestJS listed as an alternative considered.

## D3. Authentication

**Question:** Do we need login or Keycloak?

**Answer:** **[BRIEF]** "A simple selector is enough; login is not required."

**Decision:** No auth. Listed under README limitations: anyone with the URL can act as any worker.

## D4. Tailwind, Motion and beUI

**Question:** The beUI components need Tailwind and Motion. Add them?

**Answer:** Yes, if limited to the 5 components actually used, copied into the repo (MIT) and read before committing. Animate only opacity and transform; respect `prefers-reduced-motion`.

**Decision:** **[DECISION]** Added to the stack (cahier §5) with ADR9. Plain CSS stays the fallback.

## D5. One task list

**Question:** Where should the task list live?

**Decision:** In the task tracker (now [tasks.md](../../specs/001-live-staffing-dashboard/tasks.md)) only; the cahier points to it, so there is one list to tick.

## D6. Mobbin

**Answer:** The Mobbin MCP returned "requires a paid plan". RareUI was blocked by a bot checkpoint.

**Decision:** Used Dribbble, beUI, transitions.dev and Recent instead. Mobbin and RareUI only manually, if time allows.

## D7. Re-inviting a Declined worker

**Question:** I thought the document says the manager can re-send an invitation to a worker who declined. Is A1 ("No") wrong?

**Checked against the PDF (both pages re-read):**
- Flow line: "Invited → Accepted / Declined → Checked in → Checked out (only Accepted continues to check-in)." Declined has no way out.
- Rules: "The manager sends an invitation; the worker accepts or declines." Nothing about inviting again.
- The only "again" in the brief: "a Cancelled worker may accept again". That is the Cancelled path (A5), not Declined.

**Answer:** The PDF does not say it. It does not forbid it either; it is undefined.

**Decision:** **[ASSUMPTION]** Keep A1 = No. If asked: "The brief only allows a Cancelled worker to accept again and defines no way out of Declined, so I didn't add one. Adding it is one row in the transition table and one test." Rehearsed as the live change (Phase 13).

## D8. Retries and connection loss

**Question:** When the connection fails and comes back, is anything saved locally? What happens?

**Answer:**
- **Actions (POST):** network error or 5xx → retry twice (300 ms, 1 s), 8 s timeout each. Then stop, re-enable the button, toast "Couldn't reach the server. Nothing was saved. Try again." Nothing in localStorage, nothing replayed later. 4xx is never retried.
- **Live updates (SSE):** badge goes to Reconnecting, then Offline with the last sync time. The screen keeps the last state in memory only. Reconnect with backoff 1/2/4/max 10 s. On reconnect the server sends the full snapshot first; the client replaces its state if the version is newer.
- **Lost response:** the server committed, the response was lost, the client retries → server sees the worker already in the target state → `200 changed:false`, original timestamp kept → UI shows "Already checked in at 14:02". No duplicate.
- **Why no offline queue:** a queued action can be stale (shift filled meanwhile), the user would believe it was saved, and the brief only asks to indicate the outage and catch up.

**Decision:** **[DECISION]** No local storage, no offline queue (A8). The database is the only source of truth. Demo line: "The client never pretends something was saved; it either confirms it or tells you nothing was saved."

## D9. OpenAPI

**Question:** Why no OpenAPI? Are there too few endpoints?

**Answer:** About 11 endpoints, 6 of them the same action pattern. Shared zod schemas and TS types between client and server already catch contract mismatches at compile time, which docs alone do not. A hand-written spec would drift. `@asteasolutions/zod-to-openapi` can generate `openapi.json` from the same schemas cheaply.

**Decision:** **[DECISION]** Shared types now (P0), README endpoint table (P0), generated OpenAPI served at `/api/docs` (P2). Never hand-written.

## D10. SQL injection

**Question:** Is SQL injection handled by zod validation?

**Answer:** No. Zod checks shape; **parameterized queries** (`$1`, `$2` with `pg`) are what prevent injection, because input is never parsed as SQL. Zod is a second layer (`id` must be a positive integer, action comes from the route). The `staffing_app` role limits damage (no DELETE, DROP or event rewrites).

**Decision:** **[DECISION]** Rule: no string-built SQL anywhere. Test: an id like `1; DROP TABLE workers` returns 400.

**Correction:** in chat I said ids are UUIDs. The cahier uses positive integers (§8.3); the cahier is right.

## D11. XSS

**Answer:** React escapes everything rendered with `{}`. Users never type free text (names come from the seed). Rules: no `dangerouslySetInnerHTML` (check the beUI components too), validate the `worker` id from deep links against the known list, `helmet` with a CSP (`default-src 'self'`, `connect-src 'self'`).

**Decision:** **[DECISION]** As above, cahier §8.5.

## D12. Other security points

| Risk | Decision |
|---|---|
| CSRF | No cookies or sessions, so nothing to hijack. API and web on one origin; no `cors()` with `*`. |
| No auth | By design; documented as a limitation. |
| Abuse / DoS | 10 kb body limit, `express-rate-limit` on POST routes, cap on concurrent SSE clients. |
| Demo endpoints | Mounted only when `DEMO_MODE=true`; off by default in production. |
| Error leaks | Responses carry `{error:{code,message}}` only; stack traces go to pino logs. |
| Dependencies | Lockfile committed, `npm audit --omit=dev` in CI, non-root Docker image. |
| Secrets | `.env` git-ignored, `.env.example` committed, Postgres bound to 127.0.0.1. |

## D13. DTOs

**Question:** Should I use DTOs, or does the UI need every field anyway?

**Answer:** The concept yes, NestJS-style DTO classes no. A zod schema plus its inferred TS type is the DTO.
- **Request:** no body, only `:id`, validated by zod.
- **Response:** one mapper (`toSnapshot`) turns DB rows into the snapshot type: `snake_case` → `camelCase`, timestamps → ISO strings. Raw rows never reach the client.
- **Fields:** almost all are needed, because the brief asks for timestamps on the dashboard (shift details, both statuses, invitedAt, respondedAt, cancelledAt, checkedInAt, checkedOutAt, counts, version, last 20 events).
- **Left out:** `updated_at` and other internal columns. Event ids stay in the snapshot because the timeline uses them as React keys.

**Decision:** **[DECISION]** Snapshot type in `shared/types.ts`, one mapper in the repository layer. No further trimming: the snapshot is a few KB.
