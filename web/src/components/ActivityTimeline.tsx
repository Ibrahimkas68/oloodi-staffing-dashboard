import { useState } from 'react';
import type { ActivityEvent } from '@staffing/shared';
import { describeEvent } from '../lib/activity.js';
import { formatTime, initials } from '../lib/format.js';

function TimelineItem({ event, isNew }: { event: ActivityEvent; isNew: boolean }) {
  const { name, verb } = describeEvent(event);
  return (
    <li
      className={`grid grid-cols-[44px_26px_minmax(0,1fr)] items-center gap-2.5 border-b border-surface-sunk py-2.5 last:border-b-0 ${isNew ? 'animate-slide-in' : ''}`}
    >
      <time dateTime={event.at} className="text-[15px] text-mid">
        {formatTime(event.at)}
      </time>
      <span
        aria-hidden="true"
        className="inline-flex size-[26px] items-center justify-center rounded-pill bg-avatar text-[10px] font-semibold"
      >
        {initials(event.workerName)}
      </span>
      <span className="text-[15px] leading-[1.35]">
        <strong className="font-semibold">{name}</strong> {verb}
      </span>
    </li>
  );
}

/**
 * Recent changes, newest first, as in the design ("14:02 Amina checked in"). Items that arrive
 * after the list first appeared slide in (opacity and transform, off with reduced motion).
 * `role="log"` lets screen readers announce additions politely without re-reading the list.
 */
export function ActivityTimeline({ events }: { events: ActivityEvent[] }) {
  // Events already there on first render are history, not news: they do not animate.
  const [newestSeenOnMount] = useState(() => events[0]?.id ?? 0);

  if (events.length === 0) {
    return (
      <p className="m-0 py-4 text-[15px] leading-[1.45] text-mid">
        No activity yet. Invites, replies and check-ins will appear here as they happen.
      </p>
    );
  }
  return (
    <ol
      role="log"
      aria-label="Recent activity, newest first"
      tabIndex={0}
      className="m-0 max-h-[420px] list-none overflow-y-auto p-0 focus-visible:outline-2 focus-visible:outline-ink"
    >
      {events.map((event) => (
        <TimelineItem key={event.id} event={event} isNew={event.id > newestSeenOnMount} />
      ))}
    </ol>
  );
}
