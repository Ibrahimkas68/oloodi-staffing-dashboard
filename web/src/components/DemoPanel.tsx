import { useState } from 'react';
import type { Snapshot } from '@staffing/shared';
import {
  BURST_SIZE,
  OUTAGE_SECONDS,
  pickDemoTarget,
  sendCheckInBurst,
  simulateOutage,
  type DemoOutcome,
} from '../lib/demo.js';
import { firstName } from '../lib/format.js';
import { useToast } from './Toasts.js';

const DEMO_BUTTON =
  'h-9 cursor-pointer whitespace-nowrap rounded-sm border border-shell-edge bg-shell-hover px-3.5 font-mono text-sm font-medium text-shell-text transition-[transform,background-color] duration-150 hover:bg-shell-raised-hover active:scale-[0.97] aria-disabled:cursor-default aria-disabled:opacity-60 aria-disabled:active:scale-100 focus-visible:outline-2 focus-visible:outline-live';

/**
 * Developer-only controls (dashed violet border, as in the design). Rendered by the page only when
 * the snapshot says demo mode is on. Results come back as toasts; the changes themselves arrive
 * through the live stream like any other.
 */
export function DemoPanel({ snapshot }: { snapshot: Snapshot }) {
  const toast = useToast();
  const [busy, setBusy] = useState<'burst' | 'outage' | null>(null);
  const target = pickDemoTarget(snapshot.assignments);

  async function run(
    kind: 'burst' | 'outage',
    send: () => Promise<DemoOutcome>,
    successTitle: string,
    successSub: string,
  ) {
    if (busy) return;
    setBusy(kind);
    const outcome = await send();
    setBusy(null);
    if (outcome.ok) toast('neutral', successTitle, successSub);
    else if (outcome.kind === 'refused') toast('conflict', outcome.message);
    else toast('network', "Couldn't reach the server. The demo control was not applied.");
  }

  return (
    <section
      aria-label="Demo controls"
      className="flex w-max max-w-full flex-col gap-2.5 self-end rounded-card border-[1.5px] border-dashed border-violet bg-[#0b0c0e] px-3.5 py-3 text-[#e8e9e4] shadow-float"
    >
      <div className="flex justify-between gap-4 font-mono text-xs tracking-[0.08em]">
        <span className="font-medium text-violet-soft">DEMO MODE</span>
        <span className="text-muted">
          target: {target ? firstName(target.worker.fullName) : 'none yet'}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={DEMO_BUTTON}
          aria-disabled={busy !== null || target === null || undefined}
          title={target === null ? 'Needs a worker who accepted' : undefined}
          onClick={() => {
            if (target)
              void run(
                'burst',
                () => sendCheckInBurst(target.id),
                `Sent ${BURST_SIZE} check-ins at once`,
                'Only one should show in the activity feed.',
              );
          }}
        >
          {busy === 'burst' ? 'Sending…' : `Spam check-in ×${BURST_SIZE}`}
        </button>
        <button
          type="button"
          className={DEMO_BUTTON}
          aria-disabled={busy !== null || undefined}
          onClick={() =>
            void run(
              'outage',
              () => simulateOutage(),
              `Outage of ${OUTAGE_SECONDS}s started`,
              'The badge should show Reconnecting, then Live.',
            )
          }
        >
          {busy === 'outage' ? 'Starting…' : `Simulate ${OUTAGE_SECONDS}s outage`}
        </button>
      </div>
    </section>
  );
}
