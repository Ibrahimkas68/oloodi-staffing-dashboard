import { Brand } from '../components/Brand.js';
import { ConnectionBadge, OfflineBanner } from '../components/Connection.js';
import { useLive } from '../lib/live.js';

/**
 * Manager dashboard shell from docs/design/Dashboard.dc.html: dark app shell, light main card,
 * right rail. KPI row, readiness line, worker table and timeline come with User Story 1.
 */
export function ManagerPage() {
  const { snapshot } = useLive();

  return (
    <div className="flex min-h-screen text-shell-text">
      <nav className="hidden w-[180px] shrink-0 flex-col gap-8 px-3.5 py-7 lg:flex" aria-label="Views">
        <div className="px-2.5">
          <Brand />
        </div>
        <div className="flex flex-col gap-1 text-[15px]">
          <a href="/" aria-current="page" className="flex h-10 items-center rounded-sm bg-shell-hover px-3 font-medium">
            Dashboard
          </a>
          <a href="/worker" className="flex h-10 items-center rounded-sm px-3 text-shell-mid hover:text-shell-text">
            Worker view
          </a>
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col p-3 lg:pl-0">
        <OfflineBanner />
        <header className="flex min-h-[84px] flex-wrap items-center justify-between gap-6 px-2 py-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="m-0 text-[26px] leading-[1.15] font-semibold tracking-tight">
              {snapshot?.shift.title ?? 'Loading the shift…'}
            </h1>
          </div>
          <ConnectionBadge />
        </header>
        <main className="flex-1 rounded-panel bg-surface p-6 text-ink">
          {snapshot && (
            <p className="text-mid">
              Filled {snapshot.counts.filled}/{snapshot.shift.requiredWorkers} · v{snapshot.version}
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
