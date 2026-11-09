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

**Environment** (same for the three runs; git commit `b876293`, working tree clean):

- Machine: Apple M2 Pro, 10 cores, 16 GiB RAM, Mac14,9
- OS: macOS 27.0.1 (darwin 27.0.0 arm64)
- Power: Now drawing from 'AC Power'
- Node v22.22.3, Playwright 1.65.0, headless Chromium 158.0.8127.18
- Postgres in Docker (OrbStack engine), app server started by the tool on port 3100
- Config: 20 measured runs, 6 warm-up runs, outage 5000 ms, pause 250 ms

Full runs done: 3. Every one is reported below; none was left out. Times in ms.

**Update delay**

| Run | Samples | Failed | Min | Median | p95 | Max | Mean |
|---|---|---|---|---|---|---|---|
| 1 (2026-11-09T18-58-59-553Z) | 20 | 0 | 14 | 21 | 39 | 45 | 22.9 |
| 2 (2026-11-09T19-01-51-228Z) | 20 | 0 | 12 | 19 | 25 | 28 | 18.8 |
| 3 (2026-11-09T19-04-43-088Z) | 20 | 0 | 15 | 23 | 28 | 29 | 23 |
| **Pooled, 3 runs** | 60 | 0 | 12 | 21 | 29 | 45 | 21.6 |

Warm-up values (kept, not judged): run 1: 18, 17, 31, 23, 25, 28; run 2: 18, 18, 30, 22, 24, 25; run 3: 15, 30, 23, 26, 26, 28.

**Recovery time**

| Run | Samples | Failed | Min | Median | p95 | Max | Mean |
|---|---|---|---|---|---|---|---|
| 1 (2026-11-09T18-58-59-553Z) | 20 | 0 | 7 | 15 | 17 | 18 | 14 |
| 2 (2026-11-09T19-01-51-228Z) | 20 | 0 | 8 | 16.5 | 19 | 20 | 15.4 |
| 3 (2026-11-09T19-04-43-088Z) | 20 | 0 | 8 | 16.5 | 20 | 67 | 18.1 |
| **Pooled, 3 runs** | 60 | 0 | 7 | 16 | 20 | 67 | 15.8 |

Warm-up values (kept, not judged): run 1: 16, 14, 17, 12, 8, 11; run 2: 17, 18, 21, 14, 17, 16; run 3: 20, 10, 8, 14, 20, 10.

## Environment and results: Docker run

Run with `npm run measure:docker`. Chromium, the app and Postgres run in containers. In the output,
the CPU, RAM and OS describe the Linux VM that runs the containers, not the Mac.

<!-- RESULTS:docker -->

**Environment** (same for the three runs; git commit `b876293`, working tree clean):

- Machine: the Linux VM of the OrbStack engine, not the Mac: 10 cores, 7.8 GiB RAM, linux 7.2.12-orbstack-00394-gbecdd6130068 arm64. The CPU model is "unknown" because the VM does not report one.
- Docker: 29.8.2 10 8392671232 OrbStack
- Node v26.13.0 (the one inside the pinned Playwright image), Playwright 1.65.0, headless Chromium 158.0.8127.18
- Host power at the time: AC power (recorded by hand before each run in the session log, not by the tool, which cannot see the host from inside the container)
- Config: 20 measured runs, 6 warm-up runs, outage 5000 ms, pause 250 ms

Full runs done: 3. Every one is reported below; none was left out. Times in ms.

**Update delay**

| Run | Samples | Failed | Min | Median | p95 | Max | Mean |
|---|---|---|---|---|---|---|---|
| 1 (2026-11-09T19-08-11-122Z) | 20 | 0 | 5 | 15 | 18 | 19 | 14.5 |
| 2 (2026-11-09T19-10-57-441Z) | 20 | 0 | 6 | 17 | 19 | 21 | 15.8 |
| 3 (2026-11-09T19-13-43-817Z) | 20 | 0 | 9 | 14.5 | 22 | 23 | 15.1 |
| **Pooled, 3 runs** | 60 | 0 | 5 | 15 | 21 | 23 | 15.1 |

Warm-up values (kept, not judged): run 1: 7, 7, 15, 13, 10, 17; run 2: 9, 17, 11, 19, 16, 19; run 3: 6, 12, 12, 15, 16, 16.

**Recovery time**

| Run | Samples | Failed | Min | Median | p95 | Max | Mean |
|---|---|---|---|---|---|---|---|
| 1 (2026-11-09T19-08-11-122Z) | 20 | 0 | 10 | 20 | 27 | 33 | 20.2 |
| 2 (2026-11-09T19-10-57-441Z) | 20 | 0 | 6 | 19 | 20 | 24 | 17.4 |
| 3 (2026-11-09T19-13-43-817Z) | 20 | 0 | 8 | 22.5 | 27 | 27 | 21.7 |
| **Pooled, 3 runs** | 60 | 0 | 6 | 20 | 27 | 33 | 19.7 |

Warm-up values (kept, not judged): run 1: 23, 23, 21, 17, 17, 10; run 2: 21, 20, 15, 21, 20, 20; run 3: 23, 22, 21, 26, 23, 23.

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

Six full runs were done (three host, three Docker), all on commit `b876293` with a clean tree and the
Mac on AC power. None failed and none aborted, so both criteria are judged on every sample.

| Criterion | Limit | Host run (3 runs, 60 samples) | Docker run (3 runs, 60 samples) | Verdict |
|---|---|---|---|---|
| SC-005, median update delay | under 1000 ms, no failed run | median 21 ms, max 45 ms, 0 failed | median 15 ms, max 23 ms, 0 failed | Met in all six runs |
| SC-006, every recovery | under 15 000 ms, none failed | median 16 ms, max 67 ms, 0 failed | median 20 ms, max 33 ms, 0 failed | Met in all six runs |

The host and Docker figures are separate measurements on different stacks and are not merged. All
recoveries completed through the browser's `online` event, not through the 10 s probe.

These results hold for loopback, emulated network loss and a 3-worker dashboard, as the limitations
below say. They are not a claim about a real network.

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
- **Background load on the Mac during the host run.** macOS system processes (photo analysis, Storage,
  Spotlight indexing) were seen running around the session. The conditions logged before each run were
  AC power, 46 to 83 percent CPU idle and a load average between 3.3 and 9.2. The runs were not made on
  an idle machine, which may have widened the spread. The Docker figures were taken right after, under the
  same conditions.
- **One recovery outlier.** Host run 3 has one recovery of 67 ms, well above the other 59 (7 to 20 ms).
  It is kept: no sample was removed. The cause was not investigated, so it is not explained here.
- **Docker run environment.** The engine is OrbStack, so the "machine" in the Docker results is its Linux
  VM (10 cores, 7.8 GiB RAM). Node there is v26.13.0 (from the pinned Playwright image), while the host
  run uses v22.22.3. The CPU model is not reported inside the VM, and the host power source cannot be
  read from inside the container.
- **Three runs per mode.** The pooled row is 60 samples from three separate runs. Run to run medians
  differ by a few ms, which is the spread to expect.

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
