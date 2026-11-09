# Design reference

Exported from the Claude Design project "Shiftboard" on 2026-11-09. These files are the visual
reference for the web app; they are not shipped with it.

| File | What it shows |
|---|---|
| `State Sheet.dc.html` | Every state: connection badge, offline banner, button states, toasts, worker states, dashboard at three moments, KPI pop-in, motion notes |
| `Design System.dc.html` | Tokens (colour, type, spacing, radius, motion) and components |
| `Dashboard.dc.html` | Manager dashboard, 1440 × 900 |
| `WorkerView.dc.html` | Worker view, 390 × 844, with the name picker |
| `Shiftboard.dc.html` | Clickable prototype wiring both screens |
| `shiftboard-data.js` | Seed data and the prototype's state logic (not used by the app) |
| `support.js`, `image-slot.js` | Claude Design runtime (renderer and image placeholders), not product code |

Tokens are implemented in `web/src/index.css` under the same names.

## Deliberately not implemented

The spec decides behaviour; the design decides look and states. Where they differ:

- **"One worker, one session" lock** on the name picker ("In use", "Use this phone instead"). The
  spec allows two sessions for the same worker and keeps them consistent with versioned snapshots
  and idempotent actions; a lock would need session tracking the brief does not ask for.
- **"Signed in as"** in the worker header is shown as **"Viewing as"**: there is no login.
- **Memoji image slots** on the picker: initials avatars instead.
- **Workers and Activity nav items**: the app has one shift and two views, so the nav links to the
  dashboard and the worker view.
- **Phone frame and status-bar clock**: mock-up chrome only.
- **Pronouns in conflict messages** ("so she can't check in again"): the app does not store
  pronouns, so server messages say "this worker".
