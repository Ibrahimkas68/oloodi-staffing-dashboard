import type { ReactNode } from 'react';
import type { Assignment, Participation } from '@staffing/shared';
import { formatTime } from '../lib/format.js';
import { AttendanceChip, ParticipationPill } from './StatusBadges.js';

/**
 * Label for the response time. Accept, decline and cancel all stamp `respondedAt`, so the label
 * follows the current participation. There is no "Cancelled at" row for a worker who accepted
 * again: the old cancellation time stays in the data but is no longer the current story.
 */
const RESPONSE_LABEL: Partial<Record<Participation, string>> = {
  accepted: 'Accepted at',
  declined: 'Declined at',
  cancelled: 'Cancelled at',
};

type RecordedTime = { label: string; iso: string };

/** The times that exist, in the order things happen. Missing ones are left out. */
function recordedTimes(a: Assignment): RecordedTime[] {
  const rows: Array<{ label: string | undefined; iso: string | null }> = [
    { label: 'Invited at', iso: a.invitedAt },
    { label: RESPONSE_LABEL[a.participation], iso: a.respondedAt },
    { label: 'Checked in at', iso: a.checkedInAt },
    { label: 'Checked out at', iso: a.checkedOutAt },
  ];
  return rows.flatMap(({ label, iso }) => (label && iso ? [{ label, iso }] : []));
}

function StatusRow({ label, children, divided }: { label: string; children: ReactNode; divided?: boolean }) {
  return (
    <div className={`flex min-h-[54px] items-center justify-between ${divided ? 'border-b border-line-soft' : ''}`}>
      <dt className="text-[15px] text-mid">{label}</dt>
      <dd className="m-0">{children}</dd>
    </div>
  );
}

/** The worker's two statuses: did they say yes, and are they on site. */
export function StatusCard({ assignment }: { assignment: Assignment }) {
  return (
    <section aria-label="Your status" className="rounded-card border border-line bg-card px-4">
      <dl className="m-0">
        <StatusRow label="Participation" divided>
          <ParticipationPill value={assignment.participation} />
        </StatusRow>
        <StatusRow label="Attendance">
          <AttendanceChip value={assignment.attendance} />
        </StatusRow>
      </dl>
    </section>
  );
}

/** The times recorded so far, in the order they happened. Renders nothing before the first one. */
export function RecordedTimes({ assignment, className = '' }: { assignment: Assignment; className?: string }) {
  const times = recordedTimes(assignment);
  if (times.length === 0) return null;
  return (
    <section data-testid="recorded-times" className={`flex flex-col gap-2 px-1 pt-1 ${className}`}>
      <h2 className="m-0 text-[13px] font-medium text-mid">Recorded times</h2>
      <dl className="m-0 flex flex-col gap-2">
        {times.map(({ label, iso }) => (
          <div key={label} className="flex gap-1.5 text-[15px]">
            <dt className="text-mid">{label}</dt>
            <dd className="m-0 font-semibold">
              <time dateTime={iso}>{formatTime(iso)}</time>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
