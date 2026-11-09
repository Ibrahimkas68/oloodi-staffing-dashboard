import { useState } from 'react';
import type { ActivityEvent, Snapshot } from '@staffing/shared';
import { formatTime, initials } from '../lib/format.js';
import { useAction } from '../lib/useAction.js';
import { Button } from './Button.js';
import { AttendanceChip, ParticipationPill } from './StatusBadges.js';

type Column = { label: string; widthClass?: string; headClass: string };

/**
 * The Worker column takes the leftover width (at least 200px, 140px on phones); the others are
 * fixed. Name and Action stay sticky (z-10, above the positioned middle cells) while scrolling.
 */
const COLUMNS: Column[] = [
  { label: 'Worker', headClass: 'sticky left-0 z-10 bg-card-head pr-2.5 pl-4' },
  { label: 'Participation', widthClass: 'w-[124px]', headClass: 'px-2.5' },
  { label: 'Attendance', widthClass: 'w-[150px]', headClass: 'px-2.5' },
  { label: 'Invited', widthClass: 'w-[68px]', headClass: 'px-2' },
  { label: 'Responded', widthClass: 'w-[90px]', headClass: 'px-2' },
  { label: 'Checked in', widthClass: 'w-[84px]', headClass: 'px-2 whitespace-nowrap' },
  { label: 'Checked out', widthClass: 'w-[96px]', headClass: 'px-2 whitespace-nowrap' },
  { label: 'Action', widthClass: 'w-[100px]', headClass: 'sticky right-0 z-10 bg-card-head pr-4 pl-1 text-right' },
];

const nameCellId = (assignmentId: number) => `worker-name-${assignmentId}`;

/**
 * "a" or "b" on the row changed by `event`, alternating per event so the CSS animation restarts
 * for every change (see `.worker-row` in index.css); undefined on the other rows.
 */
function highlightFor(event: ActivityEvent | undefined, assignmentId: number): 'a' | 'b' | undefined {
  if (event?.assignmentId !== assignmentId) return undefined;
  return event.id % 2 === 0 ? 'a' : 'b';
}

function Time({ iso }: { iso: string | null }) {
  if (iso === null) {
    return (
      <span className="text-muted">
        <span aria-hidden="true">—</span>
        <span className="sr-only">Not recorded</span>
      </span>
    );
  }
  return (
    <time dateTime={iso} className="text-ink">
      {formatTime(iso)}
    </time>
  );
}

/**
 * The Invite button disappears once the worker is no longer uninvited, which would drop keyboard
 * focus onto the page. Move it to the worker's name cell instead, unless the user has moved on.
 */
function keepFocusOnRow(assignmentId: number) {
  const nameCell = document.getElementById(nameCellId(assignmentId));
  const active = document.activeElement;
  const focusIsLost = !active || active === document.body || nameCell?.parentElement?.contains(active);
  if (focusIsLost) nameCell?.focus();
}

/**
 * The manager's roster. The row changed by the latest live event is highlighted in lime for 1 s
 * so changes are noticeable; with reduced motion it gets a static lime border instead (see
 * `.worker-row` in index.css). `headingId` names the scroll region.
 */
export function WorkerTable({ snapshot, headingId }: { snapshot: Snapshot; headingId: string }) {
  const { run, isPending } = useAction();
  const latestEvent = snapshot.recentEvents[0];
  // The event that was already latest when the table appeared is old news: do not highlight it.
  const [eventSeenOnMount] = useState(() => latestEvent?.id);
  const highlightEvent = latestEvent?.id === eventSeenOnMount ? undefined : latestEvent;

  async function invite(assignmentId: number) {
    // Success, refusal or network failure: the button may be gone either way.
    const outcome = await run(assignmentId, 'invite');
    if (outcome) keepFocusOnRow(assignmentId);
  }

  return (
    <div
      role="region"
      tabIndex={0}
      aria-labelledby={headingId}
      className="overflow-x-auto rounded-card border border-line bg-card focus-visible:outline-2 focus-visible:outline-ink"
    >
      <table className="w-full min-w-[852px] table-fixed sm:min-w-[912px] text-left">
        <colgroup>
          {COLUMNS.map((column) => (
            <col key={column.label} className={column.widthClass} />
          ))}
        </colgroup>
        <thead>
          <tr className="h-[42px] border-b border-surface-sunk bg-card-head text-[13px] font-medium text-mid">
            {COLUMNS.map((column) => (
              <th key={column.label} scope="col" className={`font-medium ${column.headClass}`}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {snapshot.assignments.map((a, index) => (
            <tr
              key={a.id}
              data-testid={`worker-row-${a.id}`}
              data-highlight={highlightFor(highlightEvent, a.id)}
              className={`worker-row h-[74px] ${index > 0 ? 'border-t border-line-soft' : ''}`}
            >
              <td
                id={nameCellId(a.id)}
                tabIndex={-1}
                className="sticky left-0 z-10 bg-card pr-2 pl-3.5 outline-ink focus-visible:outline-2 focus-visible:-outline-offset-2"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="hidden size-[34px] shrink-0 sm:inline-flex items-center justify-center rounded-pill bg-avatar text-sm font-semibold"
                  >
                    {initials(a.worker.fullName)}
                  </span>
                  <span className="truncate text-[17px] font-semibold">{a.worker.fullName}</span>
                </div>
              </td>
              <td className="px-2.5">
                <ParticipationPill value={a.participation} />
              </td>
              <td className="px-2.5">
                <AttendanceChip value={a.attendance} />
              </td>
              <td className="px-2 text-base">
                <Time iso={a.invitedAt} />
              </td>
              <td className="px-2 text-base">
                <Time iso={a.respondedAt} />
              </td>
              <td className="px-2 text-base">
                <Time iso={a.checkedInAt} />
              </td>
              <td className="px-2 text-base">
                <Time iso={a.checkedOutAt} />
              </td>
              <td className="sticky right-0 z-10 bg-card pr-3.5 pl-1 text-right">
                {a.participation === 'uninvited' && (
                  <Button
                    variant="invite"
                    loading={isPending(a.id, 'invite')}
                    busyLabel="Inviting…"
                    onClick={() => void invite(a.id)}
                    aria-label={`Invite ${a.worker.fullName}`}
                  >
                    Invite
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
