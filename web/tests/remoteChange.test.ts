import type { Assignment } from '@staffing/shared';
import { describe, expect, it } from 'vitest';
import { applyOwnSnapshot, applySnapshot, getLiveState, trackLocalRequest } from '../src/lib/live.js';
import { changeOrigin } from '../src/lib/remoteChange.js';

const assignment = (
  workerId: number,
  participation: Assignment['participation'],
  attendance: Assignment['attendance'] = 'not_started',
) => ({ worker: { id: workerId }, participation, attendance }) as Assignment;

describe('changeOrigin', () => {
  const invited = assignment(1, 'invited');
  const accepted = assignment(1, 'accepted');

  it('is "none" when nothing changed, whoever sent the snapshot', () => {
    expect(changeOrigin(invited, assignment(1, 'invited'), 7, 7)).toBe('none');
  });

  it('is "remote" when the snapshot that carried the change came from another session', () => {
    expect(changeOrigin(invited, accepted, 7, 7)).toBe('remote');
    expect(changeOrigin(accepted, assignment(1, 'accepted', 'checked_in'), 9, 9)).toBe('remote');
  });

  it('is "local" when the change came with this tab\'s own response', () => {
    expect(changeOrigin(invited, accepted, 7, 6)).toBe('local');
    expect(changeOrigin(invited, accepted, 7, null)).toBe('local');
  });

  it('is "none" when the screen switches to another worker or has nothing to compare', () => {
    expect(changeOrigin(invited, assignment(2, 'accepted'), 7, 7)).toBe('none');
    expect(changeOrigin(undefined, accepted, 7, 7)).toBe('none');
    expect(changeOrigin(invited, undefined, 7, 7)).toBe('none');
  });
});

describe('live store: which snapshots came from another session', () => {
  // The store is a module singleton, so versions only ever go up across these cases.
  const snap = (version: number) => ({ version, serverTime: '2026-11-09T10:00:00.000Z' }) as never;

  it('does not flag the initial load', () => {
    applySnapshot(snap(1));
    expect(getLiveState().remoteVersion).toBeNull();
  });

  it('flags a stream snapshot when this tab has nothing in flight', () => {
    applySnapshot(snap(2));
    expect(getLiveState().remoteVersion).toBe(2);
  });

  it('does not flag the stream echo of this tab\'s own request, even if it arrives first', async () => {
    const request = new Promise<void>((resolve) => setTimeout(resolve, 0));
    const tracked = trackLocalRequest(request);
    applySnapshot(snap(3)); // echo beats the HTTP response
    await tracked;
    applyOwnSnapshot(snap(3)); // response with the same version is ignored
    expect(getLiveState().snapshot?.version).toBe(3);
    expect(getLiveState().remoteVersion).toBe(2);
  });

  it('does not flag a response to this tab\'s own request', () => {
    applyOwnSnapshot(snap(4));
    expect(getLiveState().snapshot?.version).toBe(4);
    expect(getLiveState().remoteVersion).toBe(2);
  });

  it('stops counting a request once it has settled, even when it failed', async () => {
    await trackLocalRequest(Promise.reject(new Error('network'))).catch(() => undefined);
    applySnapshot(snap(5));
    expect(getLiveState().remoteVersion).toBe(5);
  });
});
