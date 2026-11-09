import type { ReactNode } from 'react';
import type { Counts } from '@staffing/shared';
import { PopNumber } from './PopNumber.js';

function KpiCard({ label, value, footer, testId }: { label: string; value: ReactNode; footer: ReactNode; testId: string }) {
  return (
    <div data-testid={testId} className="flex flex-col gap-2.5 rounded-card border border-line bg-card px-5 pt-4 pb-[18px]">
      <span className="text-base font-medium text-mid">{label}</span>
      <div className="flex items-baseline text-[64px] leading-none font-semibold tracking-[-0.03em]">{value}</div>
      <div className="flex min-h-[18px] items-center text-sm text-mid">{footer}</div>
    </div>
  );
}

/** Filled, Remaining, Checked in now, Checked out. All read from derived counts, never stored. */
export function KpiRow({ counts, required }: { counts: Counts; required: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <KpiCard
        testId="kpi-filled"
        label="Filled"
        value={
          <>
            <PopNumber value={counts.filled} />
            <span className="text-[36px] font-medium text-muted">/{required}</span>
          </>
        }
        footer={
          <span className="flex w-full gap-1" aria-hidden="true">
            {Array.from({ length: required }, (_, index) => (
              <span
                key={index}
                className={`h-2 flex-1 rounded-pill ${index < counts.filled ? 'bg-ink' : 'bg-avatar'}`}
              />
            ))}
          </span>
        }
      />
      <KpiCard testId="kpi-remaining" label="Remaining" value={<PopNumber value={counts.remaining} />} footer="places still to fill" />
      <KpiCard testId="kpi-checked-in" label="Checked in now" value={<PopNumber value={counts.checkedIn} />} footer="on site right now" />
      <KpiCard testId="kpi-checked-out" label="Checked out" value={<PopNumber value={counts.checkedOut} />} footer="still count as filled" />
    </div>
  );
}
