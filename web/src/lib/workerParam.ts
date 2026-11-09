import { useSyncExternalStore } from 'react';
import type { Assignment, Snapshot } from '@staffing/shared';

const WORKER_PARAM = 'worker';
/** A positive integer of at most nine digits, no sign, no leading zero, no decimals. */
const WORKER_ID_PATTERN = /^[1-9]\d{0,8}$/;
/** pushState and replaceState fire no event, so the app announces its own URL changes. */
const URL_CHANGED_EVENT = 'staffing:urlchange';

/**
 * The worker id in `?worker=<id>`, or null when it is missing or malformed. With a repeated
 * parameter the first value wins. This is the WORKER id, not the assignment id.
 */
export function parseWorkerParam(search: string): number | null {
  const value = new URLSearchParams(search).get(WORKER_PARAM);
  return value !== null && WORKER_ID_PATTERN.test(value) ? Number(value) : null;
}

/** The assignment of the worker being viewed, always read from the latest snapshot. */
export function findAssignmentForWorker(snapshot: Snapshot, workerId: number): Assignment | undefined {
  return snapshot.assignments.find((assignment) => assignment.worker.id === workerId);
}

function subscribe(listener: () => void): () => void {
  window.addEventListener('popstate', listener);
  window.addEventListener(URL_CHANGED_EVENT, listener);
  return () => {
    window.removeEventListener('popstate', listener);
    window.removeEventListener(URL_CHANGED_EVENT, listener);
  };
}

/** The worker chosen in the address bar; re-renders on Back, Forward and our own URL changes. */
export function useWorkerParam(): number | null {
  const search = useSyncExternalStore(subscribe, () => window.location.search);
  return parseWorkerParam(search);
}

function urlWithWorker(workerId: number | null): string {
  const url = new URL(window.location.href);
  if (workerId === null) url.searchParams.delete(WORKER_PARAM);
  else url.searchParams.set(WORKER_PARAM, String(workerId));
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Picks a worker (or null to go back to the picker). A new history entry, so Back undoes it. */
export function selectWorker(workerId: number | null): void {
  window.history.pushState(null, '', urlWithWorker(workerId));
  window.dispatchEvent(new Event(URL_CHANGED_EVENT));
}

/**
 * Drops an unusable `worker` parameter without adding a history entry, so reload and Back do not
 * return to it. Does nothing when the parameter is absent.
 */
export function clearWorkerParam(): void {
  if (!new URLSearchParams(window.location.search).has(WORKER_PARAM)) return;
  window.history.replaceState(null, '', urlWithWorker(null));
  window.dispatchEvent(new Event(URL_CHANGED_EVENT));
}
