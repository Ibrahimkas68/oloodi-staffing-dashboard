import type { Snapshot } from '@staffing/shared';
import { formatDay, formatTime } from '../lib/format.js';
import { useNow } from '../lib/useNow.js';

/** Only the date matters here, so a minute is plenty to notice midnight passing. */
const DAY_LABEL_REFRESH_MS = 60_000;

/** Shift title and details, on the dark shell (Dashboard.dc.html header). */
export function ShiftHeader({ shift }: { shift: Snapshot['shift'] }) {
  const now = useNow(DAY_LABEL_REFRESH_MS);
  const details = [
    formatDay(shift.startsAt, new Date(now)),
    `${formatTime(shift.startsAt)}–${formatTime(shift.endsAt)}`,
    shift.location,
    `${shift.requiredWorkers} workers required`,
  ];
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <h1 className="m-0 text-[26px] leading-[1.15] font-semibold tracking-tight">{shift.title}</h1>
      <p className="m-0 flex flex-wrap gap-x-2.5 text-[15px] text-shell-mid">
        {details.map((part, index) => (
          <span key={index} className="inline-flex gap-2.5">
            {index > 0 && <span aria-hidden="true">·</span>}
            {part}
          </span>
        ))}
      </p>
    </div>
  );
}
