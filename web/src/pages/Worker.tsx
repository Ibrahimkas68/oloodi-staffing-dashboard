import { useEffect, useRef } from 'react';
import type { Assignment, Snapshot } from '@staffing/shared';
import { Brand } from '../components/Brand.js';
import { ConnectionBadge, OfflineBanner } from '../components/Connection.js';
import { RemoteChangeNotice } from '../components/RemoteChangeNotice.js';
import { ShiftCard } from '../components/ShiftCard.js';
import { SideNav } from '../components/SideNav.js';
import { WorkerActions } from '../components/WorkerActions.js';
import { WorkerPicker, ViewingAs } from '../components/WorkerSelector.js';
import { RecordedTimes, StatusCard } from '../components/WorkerStatus.js';
import { useLive } from '../lib/live.js';
import { useRemoteChangeNotice } from '../lib/remoteChange.js';
import { clearWorkerParam, findAssignmentForWorker, selectWorker, useWorkerParam } from '../lib/workerParam.js';

/** Keeps the last button clear of the toasts that pop up at the bottom of a phone screen. */
const TOAST_CLEARANCE = 'pb-24 md:pb-8';

/**
 * Moves keyboard focus to the new screen's heading when the worker on screen changes (a pick,
 * Switch, or Back), so screen readers and keyboard users land on the new screen instead of a
 * vanished button. `shownWorkerId` is the worker actually displayed (null = the picker), so a bad
 * id in the address bar, which only ever shows the picker, never steals focus. The first screen
 * after the data arrives is left alone.
 */
function useFocusOnWorkerChange(shownWorkerId: number | null, ready: boolean) {
  const contentRef = useRef<HTMLElement>(null);
  const previous = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    if (!ready) return;
    if (previous.current !== undefined && previous.current !== shownWorkerId) {
      const heading = contentRef.current?.querySelector<HTMLElement>('h1');
      (heading ?? contentRef.current)?.focus();
    }
    previous.current = shownWorkerId;
  }, [shownWorkerId, ready]);
  return contentRef;
}

/**
 * The signed-in worker's screen. On phones everything is one column, in the order of the design:
 * shift, status, buttons, recorded times. From `md` up it becomes two columns, what the shift is
 * on the left and what the worker can do on the right. The wrappers are `display: contents` on
 * phones, so the same elements serve both layouts.
 */
function WorkerScreen({ assignment, snapshot }: { assignment: Assignment; snapshot: Snapshot }) {
  const updatedElsewhere = useRemoteChangeNotice(assignment);
  return (
    <div className="flex flex-col gap-3 p-4 md:max-w-[920px] md:p-0">
      <RemoteChangeNotice visible={updatedElsewhere} />
      <div className="contents md:grid md:grid-cols-2 md:items-start md:gap-6">
        <div className="contents md:flex md:flex-col md:gap-3">
          <ShiftCard shift={snapshot.shift} />
          <RecordedTimes assignment={assignment} className="max-md:order-last" />
        </div>
        <div className="contents md:flex md:flex-col md:gap-3">
          <StatusCard assignment={assignment} />
          <WorkerActions assignment={assignment} />
        </div>
      </div>
    </div>
  );
}

/**
 * Worker view (docs/design/WorkerView.dc.html). There is no login: the worker picks a name, and
 * the choice lives in `?worker=<worker id>` so it survives a refresh and can be shared as a link.
 * The assignment is derived from the latest snapshot on every render, so live updates from the
 * manager show up at once.
 *
 * Layout: a phone column below `md` (the design); from `md` the dashboard's shell (dark page,
 * rounded light panel, side navigation from `lg`) with the same touch-sized controls.
 */
export function WorkerPage() {
  const { snapshot } = useLive();
  const workerId = useWorkerParam();
  const assignment = snapshot && workerId !== null ? findAssignmentForWorker(snapshot, workerId) : undefined;
  const contentRef = useFocusOnWorkerChange(assignment?.worker.id ?? null, snapshot !== null);

  // Only once a snapshot exists can a worker id be called unknown (a deep link must not flash the
  // picker while loading). Then the bad parameter is dropped so reload and Back do not loop.
  const needsPicker = snapshot !== null && assignment === undefined;
  useEffect(() => {
    if (needsPicker) clearWorkerParam();
  }, [needsPicker]);

  return (
    <div className="min-h-dvh text-shell-text lg:flex">
      <SideNav current="worker" />
      <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col md:max-w-none md:p-3 lg:min-w-0 lg:flex-1 lg:pl-0">
        <OfflineBanner layout="adaptive" />
        <header className="order-1 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3.5 bg-shell p-4 md:order-2 md:min-h-[84px] md:grid-cols-[minmax(0,1fr)_auto_auto] md:bg-transparent md:px-2 md:py-3">
          <div className="flex items-center gap-5 lg:hidden">
            <Brand size="sm" />
            {/* The side navigation is hidden below lg, so the dashboard needs another way in. */}
            <a
              href="/"
              className="hidden h-[38px] items-center rounded-pill border border-shell-line px-4 text-[15px] text-shell-mid hover:text-shell-text md:inline-flex"
            >
              Dashboard
            </a>
          </div>
          <div className="md:col-start-3 md:row-start-1">
            <ConnectionBadge size="phone" />
          </div>
          {assignment && (
            <div className="col-span-2 min-w-0 md:col-span-1 md:col-start-2 md:row-start-1">
              <ViewingAs assignment={assignment} onSwitch={() => selectWorker(null)} />
            </div>
          )}
        </header>
        <main
          ref={contentRef}
          tabIndex={-1}
          className={`order-3 flex flex-1 flex-col bg-surface text-ink outline-none md:rounded-panel md:p-8 lg:p-10 ${TOAST_CLEARANCE}`}
        >
          {snapshot === null && (
            <p role="status" className="m-0 p-4 text-mid md:p-0">
              Loading your shift…
            </p>
          )}
          {snapshot && !assignment && <WorkerPicker snapshot={snapshot} onPick={selectWorker} />}
          {snapshot && assignment && <WorkerScreen assignment={assignment} snapshot={snapshot} />}
        </main>
      </div>
    </div>
  );
}
