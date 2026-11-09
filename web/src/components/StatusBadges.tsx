import type { Attendance, Participation } from '@staffing/shared';

const PARTICIPATION: Record<Participation, { label: string; className: string }> = {
  uninvited: { label: 'Uninvited', className: 'bg-p-uninvited text-p-uninvited-fg' },
  invited: { label: 'Invited', className: 'bg-p-invited text-p-invited-fg' },
  accepted: { label: 'Accepted', className: 'bg-p-accepted text-p-accepted-fg' },
  declined: { label: 'Declined', className: 'bg-p-declined text-p-declined-fg' },
  cancelled: { label: 'Cancelled', className: 'bg-p-cancelled text-p-cancelled-fg' },
};

export const participationLabel = (value: Participation) => PARTICIPATION[value].label;

/** Participation: soft-tinted pill. The word always carries the meaning, colour backs it up. */
export function ParticipationPill({ value }: { value: Participation }) {
  const { label, className } = PARTICIPATION[value];
  return (
    <span
      className={`inline-flex h-[30px] items-center whitespace-nowrap rounded-pill px-3 text-[15px] font-semibold ${className}`}
    >
      {label}
    </span>
  );
}

const ATTENDANCE: Record<Attendance, { label: string; className: string }> = {
  not_started: { label: 'Not started', className: 'border-a-not-started-line text-a-not-started' },
  checked_in: { label: 'Checked in', className: 'border-a-checked-in text-a-checked-in' },
  checked_out: { label: 'Checked out', className: 'border-a-checked-out-line text-a-checked-out' },
};

export const attendanceLabel = (value: Attendance) => ATTENDANCE[value].label;

function AttendanceIcon({ value }: { value: Attendance }) {
  if (value === 'checked_in') {
    // Dot with a pulse: the one looping motion besides the live badge.
    return (
      <span className="relative inline-flex size-3.5 items-center justify-center" aria-hidden="true">
        <span className="absolute size-2 rounded-pill bg-live opacity-0 motion-safe:animate-pulse-dot" />
        <span className="relative size-2 rounded-pill bg-live-dot" />
      </span>
    );
  }
  if (value === 'checked_out') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <circle cx="7" cy="7" r="6.5" fill="currentColor" />
        <path d="M4.2 7.2l1.9 1.9 3.7-3.9" stroke="#FCFCFA" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="5.25" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.4 2.1" />
    </svg>
  );
}

/** Attendance: outlined chip with an icon, visually distinct from the participation pill. */
export function AttendanceChip({ value }: { value: Attendance }) {
  const { label, className } = ATTENDANCE[value];
  return (
    <span
      className={`inline-flex h-[30px] items-center gap-[7px] whitespace-nowrap rounded-pill border-[1.5px] pr-[11px] pl-[9px] text-[15px] font-medium ${className}`}
    >
      <AttendanceIcon value={value} />
      {label}
    </span>
  );
}
