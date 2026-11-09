import { ConnectionBadge, OfflineBanner } from '../components/Connection.js';
import { KpiRow } from '../components/KpiRow.js';
import { SideNav } from '../components/SideNav.js';
import { ShiftHeader } from '../components/ShiftHeader.js';
import { WorkerTable } from '../components/WorkerTable.js';
import { useLive } from '../lib/live.js';

const WORKERS_HEADING_ID = 'workers-heading';

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-[18px] gap-y-1 text-sm text-mid">
      <span className="inline-flex items-center gap-2">
        <span aria-hidden="true" className="h-4 w-7 rounded-pill bg-p-accepted" />
        Participation: did they say yes?
      </span>
      <span className="inline-flex items-center gap-2">
        <span aria-hidden="true" className="h-4 w-7 rounded-pill border-[1.5px] border-ink" />
        Attendance: are they on site?
      </span>
    </div>
  );
}

/** Manager dashboard (docs/design/Dashboard.dc.html): dark shell, light main panel. */
export function ManagerPage() {
  const { snapshot } = useLive();

  return (
    <div className="flex min-h-screen text-shell-text">
      <SideNav current="dashboard" />

      <div className="flex min-w-0 flex-1 flex-col p-3 lg:pl-0">
        <OfflineBanner />
        <header className="flex min-h-[84px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-2 py-3">
          {snapshot ? (
            <ShiftHeader shift={snapshot.shift} />
          ) : (
            <h1 className="m-0 text-[26px] font-semibold">Loading the shift…</h1>
          )}
          <div className="flex items-center gap-3">
            {/* The sidebar is hidden below lg, so the worker view needs another way in. */}
            <a
              href="/worker"
              className="inline-flex h-[38px] items-center rounded-pill border border-shell-line px-4 text-[15px] text-shell-mid hover:text-shell-text lg:hidden"
            >
              Worker view
            </a>
            <ConnectionBadge />
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-[18px] rounded-panel bg-surface p-4 text-ink sm:p-6">
          {snapshot && (
            <>
              <KpiRow counts={snapshot.counts} required={snapshot.shift.requiredWorkers} />
              <div className="mt-1 flex flex-wrap items-center justify-between gap-4">
                <h2 id={WORKERS_HEADING_ID} className="m-0 text-lg font-semibold">Workers</h2>
                <Legend />
              </div>
              <WorkerTable snapshot={snapshot} headingId={WORKERS_HEADING_ID} />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
