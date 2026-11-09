import type { Snapshot } from '@staffing/shared';
import { formatDay, formatTime } from '../lib/format.js';
import { useNow } from '../lib/useNow.js';

/** Only the date matters here, so a minute is plenty to notice midnight passing. */
const DAY_LABEL_REFRESH_MS = 60_000;

/** Light shift card for the worker view (ShiftHeader is the dark manager version). */
export function ShiftCard({ shift }: { shift: Snapshot['shift'] }) {
  const now = useNow(DAY_LABEL_REFRESH_MS);
  const details: Array<[label: string, value: string, strong?: boolean]> = [
    ['Date', formatDay(shift.startsAt, new Date(now))],
    ['Time', `${formatTime(shift.startsAt)}–${formatTime(shift.endsAt)}`, true],
    ['Location', shift.location],
    ['Team', `${shift.requiredWorkers} workers needed`],
  ];
  return (
    <section className="flex flex-col gap-3 rounded-card border border-line bg-card p-4">
      <div className="flex flex-col gap-1">
        <span className="text-[13px] font-medium text-mid">Your shift</span>
        <h1 tabIndex={-1} className="m-0 text-xl leading-tight font-semibold tracking-tight text-pretty outline-none">
          {shift.title}
        </h1>
      </div>
      <dl className="m-0 grid grid-cols-[84px_minmax(0,1fr)] gap-y-1.5 text-[15px] leading-[1.35]">
        {details.map(([label, value, strong]) => (
          <div key={label} className="contents">
            <dt className="text-mid">{label}</dt>
            <dd className={`m-0 ${strong ? 'font-semibold' : ''}`}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
