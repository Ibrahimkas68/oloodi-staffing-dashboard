# Measurements: update delay and recovery time

Every number in this file comes from a real run of `e2e/measure.ts`, with the raw samples committed
next to it. Nothing here is an estimate. Where a result is missing, it says "Not run yet."

## Purpose and targets

Two targets from the specification are confirmed or refuted here (FR-027):

- **SC-005**: a worker's action appears on an open manager dashboard without a refresh, and the median
  update delay over 20 runs is under 1 second on a local setup.
- **SC-006**: after connectivity returns, a view shows the correct current state within 15 seconds in
  every run, without user action.

Both are targets until a run confirms them. This file reports what the runs showed, including when
a target is not met.

"Local setup" means the **host run**: Node, the app server and Chromium run directly on the developer's
machine (`npm run measure`), and only Postgres runs in Docker. The **Docker run**
(`npm run measure:docker`) is a different setup: Chromium, the app and Postgres all run inside
containers, in a Linux VM. The two are reported separately and are never merged.

## Method and definitions

### Update delay

The time from the worker pressing a button to the manager's dashboard showing the change.

- **Clock.** `Date.now()` taken inside each page. Both pages run on the same machine, so they share
  one system clock with 1 ms resolution, and a worker timestamp can be subtracted from a manager
  timestamp. `performance.now()` is not used (each page has its own time origin), and nothing is timed
  around Playwright calls in Node (that would add protocol round trips).
- **t0** (worker page): a capture-phase `click` listener on `window`, installed before each run, stores
  `Date.now()`. It fires before React's own handler.
- **t1** (manager page): a `MutationObserver` on the worker's row records `Date.now()` the first time
  the text of the participation cell is exactly the expected label ("Cancelled" or "Accepted"). The
  observer is armed before the click, and the cell must show something else at that moment.
- **Result** is t1 minus t0. A run where t1 does not arrive within 10 s is recorded as failed, never
  dropped. A t1 earlier than t0 aborts the measurement.
- **Included:** the click handler, the `fetch` over loopback, Express middleware, the service
  transaction in Postgres, the hub broadcast, the manager's `EventSource` dispatch, schema parsing,
  the version guard, the render and the DOM write.
- **Excluded:** input hardware latency, browser paint (the DOM is written before the next frame, so
  paint comes up to one frame later, which is about 17 ms on a 60 Hz screen) and connection setup.

### The toggle loop

One database reset, then no reset between runs. The setup (outside any timing): reset the database,
open the manager and worker pages, wait until both say Live, invite and accept Amina over HTTP. Then
the worker toggles Amina through the UI, alternating "Cancel my spot" (accepted to cancelled, the
manager shows "Cancelled") and "Accept again" (cancelled to accepted, the manager shows "Accepted").

Runs are strictly sequential: a run starts only after the previous run's t1 and after the worker's
next button is visible, plus a 250 ms pause. Each metric has **6 warm-up runs** (kept in the JSON,
flagged `warmup: true`, left out of the statistics) followed by **20 measured runs**. The warm-up
count is even, so the measured set has 10 cancels and 10 accepts; the output prints the split.

### Recovery time

The time from the network coming back to the manager showing the correct state.

1. Both pages are Live, showing state X.
2. The manager's browser context goes offline (`setOffline(true)`) and the run waits until the manager's
   connection badge says Offline.
3. The worker (still online) toggles Amina through the UI and shows the new state. The run checks that
   the manager still shows the old one.
4. The outage lasts **5 s** in total from step 2. It must stay under 10 s because the client probes the
   network 10 s after an `offline` event; a longer outage would measure that probe, not the recovery.
5. **t0** is `Date.now()` in Node immediately before `setOffline(false)`. It is slightly early by the
   latency of that call, so the reported recovery is slightly conservative (a little longer than the
   truth).
6. **t1** is the manager page's timestamp (`Date.now()`) for the first moment both hold: the
   participation cell shows the new state **and** the badge says Live.
7. A run that does not recover within 30 s is recorded as failed, never dropped. A run over 15 s means
   SC-006 is not met.

As a diagnostic, the manager page records when the browser fired its `online` event, and the run
stores the time from t0 to that event. The output and the JSON say, per run, whether the event
fired. If it does not, recovery waits for the 10 s probe and the numbers are much larger.

### Statistics

For each metric: count, min, median, p95, max and mean of the measured runs that did not fail. The
median of an even count is the mean of the two middle values. p95 is by nearest rank, the value at
position `ceil(0.95 * n)` of the sorted samples, which for 20 samples is the 19th value, so it is
indicative only. The median and the max are the figures to quote. Failed runs are counted
separately.

## Environment and results: host run

Run with `npm run measure`. Node and headless Chromium run on the developer's machine, Postgres in Docker.

<!-- RESULTS:host -->

Not run yet.

## Environment and results: Docker run

Run with `npm run measure:docker`. Chromium, the app and Postgres run in containers. In the output,
the CPU, RAM and OS describe the Linux VM that runs the containers, not the Mac.

<!-- RESULTS:docker -->

Not run yet.

## Raw data

The raw samples of the runs reported above are committed in `docs/measurements/*.json`. Each file holds
the environment, the run configuration (measured runs, warm-up runs, outage length, pause), every
sample (warm-up ones flagged, with the action, the failed flag and the `online` event diagnostic) and
the statistics.

## Verdict

How the two criteria are judged, over the measured runs only:

- **SC-005 is met** when no update-delay run failed (the manager showed the change within 10 s every
  time) and the median of the measured runs is under 1000 ms. A failed run counts against the
  criterion even though it has no time to put in the median.
- **SC-006 is met** when no recovery run failed and the largest measured recovery time is under 15 s.
- A run that stopped early (the harness reached a state it did not expect) meets neither criterion. Its
  samples are still written out and marked as aborted.

<!-- VERDICT -->

Not run yet.

## Limitations

- **Loopback only.** Both pages and the server are on one machine, so there is no real network latency.
  The numbers say nothing about a real network.
- **Millisecond quantization.** `Date.now()` has 1 ms resolution.
- **DOM updated, not painted.** t1 is the DOM write, not the next frame.
- **20 samples.** With 20 measured runs, p95 is the 19th sorted value. It is indicative, not a tail
  guarantee.
- **One machine, one browser.** Headless Chromium on one computer. Other machines, browsers and mobile
  devices can differ.
- **Shared CPU.** The two pages, the server and Postgres compete for the same CPU, and the host run is
  also affected by whatever else the machine is doing. Battery or power source can matter too, so note
  it by hand with each run.
- **Recovery uses emulated network loss.** The network is cut and restored with Chromium's own offline
  emulation (`setOffline`), which fires the browser's `offline` and `online` events at once. A real
  network (wifi dropping, a cable pulled) can take longer to signal that it is back, so real recoveries
  may be slower than the numbers here.
- **Recovery covers the offline and online path only.** It does not cover silent connection drops (the
  35 s watchdog) or a server outage (the 503 path).
- **One row, three workers, no other load.** The measurements change one worker's state on a dashboard
  with three workers and nobody else using the app. More workers, many open sessions or concurrent
  actions can change the numbers.
- **Warm-up runs are not judged.** The six warm-up runs of each metric are kept in the raw data but are
  not part of the statistics, the failed-run counts or the verdicts. A failure in a warm-up run is
  visible in the console output and the JSON only.
- **Server time is not measured separately.** The time from database commit to broadcast is not
  isolated; it is inside the update delay.

## How to reproduce

0. Commit your work first. The raw data records the git commit and whether the working tree had
   uncommitted changes. A result recorded on a dirty tree is not tied to the code that produced it.
1. Close other applications, plug the computer in, and start Docker (Postgres must be running for the
   host run).
2. Host run: `npm run measure`. It starts its own server on port 3100 with the e2e database and stops
   it at the end. It refuses to start if something already answers on that port.
3. Docker run: `npm run measure:docker`. It builds the images and removes the containers afterwards.
4. Run each several times and say how many full runs were done. Do not pick the best one: report every
   full run or state the rule used to choose.
5. Copy the JSON files you cite from `e2e/measure-results/` to `docs/measurements/`.

`MEASURE_RUNS`, `MEASURE_WARMUP` and `MEASURE_OUTAGE_MS` exist for smoke tests only. The official run
uses the defaults (20, 6 and 5000).

## What the README may claim afterwards

Allowed, with a link to this file:

- "In our run on `<machine>`, median update delay `<X>` ms and max `<Y>` ms over 20 runs, recovery
  median `<Z>` ms and max `<W>` ms."

Not allowed:

- Universal claims ("updates always arrive in under a second").
- Numbers that are not in the committed JSON.
- Claims about production networks, mobile devices or silent connection drops.
