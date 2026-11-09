import { afterEach, describe, expect, it, vi } from 'vitest';
import { newRequestId } from '../src/lib/requestId.js';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** The shape the server accepts for X-Request-Id (server/src/app.ts). */
const SERVER_ACCEPTS = /^[\w-]{1,100}$/;

afterEach(() => vi.unstubAllGlobals());

describe('newRequestId', () => {
  it('uses crypto.randomUUID where the browser has it', () => {
    expect(newRequestId()).toMatch(UUID_V4);
  });

  it('still works in an insecure context, where crypto.randomUUID does not exist', () => {
    // Plain http at a non-localhost address: getRandomValues is there, randomUUID is not.
    vi.stubGlobal('crypto', { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) });
    expect((crypto as { randomUUID?: unknown }).randomUUID).toBeUndefined();

    const id = newRequestId();

    expect(id).toMatch(UUID_V4);
    expect(id).toMatch(SERVER_ACCEPTS);
  });

  it('gives a different id every time, also without crypto.randomUUID', () => {
    vi.stubGlobal('crypto', { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) });

    const ids = new Set(Array.from({ length: 200 }, () => newRequestId()));

    expect(ids.size).toBe(200);
  });
});
