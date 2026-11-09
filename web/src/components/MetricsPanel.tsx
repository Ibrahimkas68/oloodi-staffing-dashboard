import { useId, useState } from 'react';
import { useLive } from '../lib/live.js';
import { formatMs } from '../lib/metrics.js';

function Metric({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-mid">{label}</dt>
      <dd data-testid={testId} className="m-0 shrink-0 font-mono whitespace-nowrap">
        {value}
      </dd>
    </div>
  );
}

/**
 * Collapsible "Live metrics" card. The delay and recovery figures are estimates made in this
 * browser, so the card says so; the snapshot version is exact.
 */
export function MetricsPanel() {
  const { snapshot, lastUpdateDelayMs, lastRecoveryMs } = useLive();
  const [open, setOpen] = useState(true);
  const bodyId = useId();

  return (
    <section className="shrink-0 overflow-hidden rounded-card border border-line bg-card">
      <h2 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((value) => !value)}
          className="flex w-full cursor-pointer items-center justify-between border-0 bg-transparent px-3.5 py-3 text-[15px] font-semibold text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
        >
          Live metrics
          <span className="text-[13px] font-medium text-mid">{open ? 'Hide' : 'Show'}</span>
        </button>
      </h2>
      {open && (
        <div id={bodyId} className="animate-fade px-3.5 pb-3.5">
          <dl className="m-0 flex flex-col gap-2 text-sm">
            <Metric
              label="Last update delay"
              value={formatMs(lastUpdateDelayMs)}
              testId="metric-delay"
            />
            <Metric
              label="Last recovery time"
              value={formatMs(lastRecoveryMs)}
              testId="metric-recovery"
            />
            <Metric
              label="Snapshot version"
              value={snapshot ? String(snapshot.version) : '—'}
              testId="metric-version"
            />
          </dl>
          <p className="mt-2.5 mb-0 text-xs leading-[1.4] text-muted">
            Delay and recovery are estimates measured in this browser. The delay compares this
            device&apos;s clock with the server&apos;s, so a clock difference shifts it.
          </p>
        </div>
      )}
    </section>
  );
}
