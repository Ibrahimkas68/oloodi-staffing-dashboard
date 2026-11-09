import { useEffect, useRef, useState } from 'react';
import type { Assignment } from '@staffing/shared';
import { useLive } from './live.js';

/** How long "Updated from another session" stays on screen. */
const NOTICE_MS = 6_000;

export type ChangeOrigin = 'none' | 'local' | 'remote';

/**
 * Compares the worker's record before and after a snapshot. A change counts as "remote" when the
 * snapshot that carried it is the one the live store flagged as coming from another session.
 * Switching to a different worker is never a change, only a new screen.
 */
export function changeOrigin(
  before: Assignment | undefined,
  after: Assignment | undefined,
  snapshotVersion: number | undefined,
  remoteVersion: number | null,
): ChangeOrigin {
  if (!before || !after || before.worker.id !== after.worker.id) return 'none';
  const changed = before.participation !== after.participation || before.attendance !== after.attendance;
  if (!changed) return 'none';
  return snapshotVersion !== undefined && snapshotVersion === remoteVersion ? 'remote' : 'local';
}

/**
 * True for a few seconds after the worker on screen was changed from somewhere else (the manager
 * invited them, another phone checked them in). A change made by this screen's own buttons, or
 * moving to another worker, clears it, because by then the notice would be stale.
 */
export function useRemoteChangeNotice(assignment: Assignment | undefined): boolean {
  const { snapshot, remoteVersion } = useLive();
  // The version that raised the notice; a newer remote change restarts the timer.
  const [shownFor, setShownFor] = useState<number | null>(null);
  const previous = useRef<Assignment | undefined>(undefined);

  useEffect(() => {
    const origin = changeOrigin(previous.current, assignment, snapshot?.version, remoteVersion);
    if (previous.current?.worker.id !== assignment?.worker.id) setShownFor(null);
    else if (origin === 'remote') setShownFor(snapshot?.version ?? null);
    else if (origin === 'local') setShownFor(null);
    previous.current = assignment;
  }, [assignment, snapshot?.version, remoteVersion]);

  useEffect(() => {
    if (shownFor === null) return;
    const timer = setTimeout(() => setShownFor(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [shownFor]);

  return shownFor !== null;
}
