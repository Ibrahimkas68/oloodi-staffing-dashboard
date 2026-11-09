import { useEffect, useRef, type ReactNode } from 'react';
import type { Assignment } from '@staffing/shared';
import { useAction } from '../lib/useAction.js';
import {
  ACTION_UI,
  WORKER_ACTIONS,
  actionLabel,
  workerView,
  type WorkerMessage,
} from '../lib/workerView.js';
import { Button } from './Button.js';

function CheckIcon() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-pill bg-ink text-shell-text"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M3.2 7.3l2.5 2.5 5-5.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function Message({ message }: { message: WorkerMessage }) {
  if (message.tone === 'hint') {
    return <p className="m-0 text-center text-[15px] leading-[1.4] text-pretty text-mid">{message.text}</p>;
  }
  if (message.tone === 'final') {
    return (
      <div className="flex items-center gap-3 rounded-card bg-line-soft px-4 py-[18px] animate-fade">
        {message.icon === 'check' && <CheckIcon />}
        <p className="m-0 text-base leading-[1.4] font-medium text-pretty">{message.text}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1 rounded-card bg-line-soft px-4 py-5 text-center animate-fade">
      {message.title && <p className="m-0 text-[17px] font-semibold">{message.title}</p>}
      <p className="m-0 text-[15px] leading-[1.4] text-pretty text-mid">{message.text}</p>
    </div>
  );
}

/**
 * The buttons the worker may press now, plus the message for this state. Everything shown comes
 * from `workerView`, which reads the shared transition table, so a button never offers a move the
 * server would refuse.
 */
export function WorkerActions({ assignment }: { assignment: Assignment }) {
  const { run, isPending } = useAction();
  const containerRef = useRef<HTMLDivElement>(null);
  const { actions, message } = workerView(assignment);
  // One tap at a time. Not tied to being offline: a failed request just explains itself (A8).
  const busy = WORKER_ACTIONS.some((action) => isPending(assignment.id, action));

  /**
   * A button often disappears under the user's finger or cursor: after their own tap (Accept turns
   * into Check in) or because another session changed the record. The browser then drops focus onto
   * the page, so when the set of buttons changes and focus was lost, it moves to this container.
   */
  const buttonSet = actions.join();
  const previousSet = useRef(buttonSet);
  useEffect(() => {
    if (previousSet.current === buttonSet) return;
    previousSet.current = buttonSet;
    const active = document.activeElement;
    if (!active || active === document.body) containerRef.current?.focus();
  }, [buttonSet]);

  const buttons: ReactNode[] = actions.map((action) => {
    const pending = isPending(assignment.id, action);
    return (
      <Button
        key={action}
        variant={ACTION_UI[action].variant}
        loading={pending}
        busyLabel={ACTION_UI[action].busyLabel}
        disabled={busy && !pending}
        // "Cancel my spot" hangs 4px closer to Check in than the other buttons are to each other.
        className={action === 'cancel' ? '-mt-1' : undefined}
        onClick={() => void run(assignment.id, action)}
      >
        {actionLabel(action, assignment)}
      </Button>
    );
  });

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label="Your actions"
      tabIndex={-1}
      // No aria-live here: the toast already announces the outcome of every action.
      className="mt-1 flex flex-col gap-2.5 outline-none"
      data-testid="worker-actions"
    >
      {message && <Message message={message} />}
      {buttons}
    </div>
  );
}
