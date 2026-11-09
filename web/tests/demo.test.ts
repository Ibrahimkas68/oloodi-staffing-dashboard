import type { Assignment } from '@staffing/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickDemoTarget, sendCheckInBurst, simulateOutage } from '../src/lib/demo.js';

const a = (
  id: number,
  participation: Assignment['participation'],
  attendance: Assignment['attendance'],
) => ({ id, participation, attendance }) as Assignment;

describe('pickDemoTarget', () => {
  it('prefers an accepted worker who has not checked in', () => {
    expect(
      pickDemoTarget([a(1, 'accepted', 'checked_in'), a(2, 'accepted', 'not_started')])?.id,
    ).toBe(2);
  });
  it('falls back to any accepted worker, then to nobody', () => {
    expect(
      pickDemoTarget([a(1, 'invited', 'not_started'), a(2, 'accepted', 'checked_in')])?.id,
    ).toBe(2);
    expect(pickDemoTarget([a(1, 'invited', 'not_started')])).toBeNull();
  });
});

describe('demo requests', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('posts to the contract URLs', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    await sendCheckInBurst(7);
    await simulateOutage();
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/demo/burst?assignmentId=7&action=check-in');
    expect(fetchMock.mock.calls[1]![0]).toBe('/api/demo/outage?seconds=5');
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: 'POST' });
  });

  it('reports a refusal with the server message and a network failure as unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: { code: 'NOT_FOUND', message: 'Demo mode is off.' } }),
      }),
    );
    expect(await simulateOutage()).toEqual({
      ok: false,
      kind: 'refused',
      message: 'Demo mode is off.',
    });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    expect(await simulateOutage()).toEqual({ ok: false, kind: 'unreachable' });
  });
});
