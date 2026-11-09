import type { ActionResult } from '@staffing/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { postAction, RETRY_DELAYS_MS } from '../src/lib/api.js';

const NOW = '2026-11-09T10:00:00.000Z';

const okBody: ActionResult = {
  changed: true,
  snapshot: {
    version: 1,
    serverTime: NOW,
    demoMode: false,
    shift: { id: 1, title: 'Shift', location: 'Rabat', startsAt: NOW, endsAt: NOW, requiredWorkers: 3 },
    assignments: [],
    counts: { filled: 0, remaining: 3, checkedIn: 0, checkedOut: 0, invited: 1, declined: 0, cancelled: 0, uninvited: 2 },
    recentEvents: [],
  },
};

const json = (body: unknown, status = 200) => Response.json(body, { status });
const serverError = () => json({ error: { code: 'INTERNAL', message: 'Boom' }, requestId: 'r' }, 500);
const networkError = () => Promise.reject(new TypeError('Failed to fetch'));

const fetchMock = vi.fn<typeof fetch>();

/** Runs postAction to completion while fake timers drive the waits between attempts. */
async function runAction() {
  const outcome = postAction(1, 'invite');
  await vi.runAllTimersAsync();
  return outcome;
}

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('postAction', () => {
  it('parses a successful ActionResult on the first try', async () => {
    fetchMock.mockResolvedValueOnce(json(okBody));

    expect(await runAction()).toEqual({ ok: true, result: okBody });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/assignments/1/invite');
    expect(init).toMatchObject({ method: 'POST', cache: 'no-store' });
  });

  it('retries after 300 ms when the network fails once', async () => {
    fetchMock.mockImplementationOnce(networkError).mockResolvedValueOnce(json(okBody));

    const outcome = postAction(1, 'invite');
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0] - 1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);

    expect(await outcome).toMatchObject({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries a second time after another 1000 ms', async () => {
    fetchMock.mockImplementationOnce(networkError).mockImplementationOnce(networkError).mockResolvedValueOnce(json(okBody));

    const outcome = postAction(1, 'invite');
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[1] - 1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);

    expect(await outcome).toMatchObject({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('gives up as unreachable after three failed attempts', async () => {
    fetchMock.mockImplementation(networkError);

    expect(await runAction()).toEqual({ ok: false, kind: 'unreachable' });
    expect(fetchMock).toHaveBeenCalledTimes(RETRY_DELAYS_MS.length + 1);
  });

  it('retries a 5xx answer', async () => {
    fetchMock.mockResolvedValueOnce(serverError()).mockResolvedValueOnce(json(okBody));

    expect(await runAction()).toMatchObject({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 4xx refusal and returns the error body', async () => {
    const error = { code: 'INVALID_TRANSITION', message: 'Cannot check in: this spot was cancelled.' };
    fetchMock.mockResolvedValueOnce(json({ error, requestId: 'r' }, 409));

    expect(await runAction()).toEqual({ ok: false, kind: 'refused', status: 409, error });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reuses one request id across retries so the server can treat them as one action', async () => {
    fetchMock.mockImplementationOnce(networkError).mockResolvedValueOnce(json(okBody));

    await runAction();

    const ids = fetchMock.mock.calls.map(([, init]) => (init!.headers as Record<string, string>)['X-Request-Id']);
    expect(ids[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(ids[1]).toBe(ids[0]);
  });

  it('aborts an attempt that takes longer than the timeout and retries', async () => {
    fetchMock.mockImplementationOnce(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init!.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    fetchMock.mockResolvedValueOnce(json(okBody));

    expect(await runAction()).toMatchObject({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('treats a 200 with an unreadable body as unreachable', async () => {
    fetchMock.mockResolvedValueOnce(json({ nonsense: true }));

    expect(await runAction()).toEqual({ ok: false, kind: 'unreachable' });
  });
});
