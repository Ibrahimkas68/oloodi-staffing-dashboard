import {
  ACTION_PATHS,
  apiErrorSchema,
  actionResultSchema,
  type Action,
  type ActionResult,
  type ApiError,
} from '@staffing/shared';
import { newRequestId } from './requestId.js';

export const TIMEOUT_MS = 8_000;
/** Delays before each retry. Retries happen only on network errors and 5xx. */
export const RETRY_DELAYS_MS = [300, 1_000] as const;

export type ActionOutcome =
  | { ok: true; result: ActionResult }
  /** The server answered with a refusal (4xx). Not retried. */
  | { ok: false; kind: 'refused'; status: number; error: ApiError['error'] }
  /** No usable answer after all retries. Nothing was saved by this request. */
  | { ok: false; kind: 'unreachable' };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function attempt(url: string, requestId: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'X-Request-Id': requestId },
      cache: 'no-store',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sends one action. Safe to retry because the server is idempotent: a retry of an action that was
 * already saved returns `changed: false` with the original time.
 */
export async function postAction(assignmentId: number, action: Action): Promise<ActionOutcome> {
  const url = `/api/assignments/${assignmentId}/${ACTION_PATHS[action]}`;
  const requestId = newRequestId();

  for (let tryIndex = 0; tryIndex <= RETRY_DELAYS_MS.length; tryIndex += 1) {
    if (tryIndex > 0) await sleep(RETRY_DELAYS_MS[tryIndex - 1]!);
    let response: Response;
    try {
      response = await attempt(url, requestId);
    } catch {
      continue; // network error or timeout: retry
    }
    if (response.status >= 500) continue;

    const body: unknown = await response.json().catch(() => null);
    if (response.ok) {
      const parsed = actionResultSchema.safeParse(body);
      if (parsed.success) return { ok: true, result: parsed.data };
      return { ok: false, kind: 'unreachable' };
    }
    const parsed = apiErrorSchema.safeParse(body);
    return {
      ok: false,
      kind: 'refused',
      status: response.status,
      error: parsed.success
        ? parsed.data.error
        : { code: 'INTERNAL', message: 'The server refused the request.' },
    };
  }
  return { ok: false, kind: 'unreachable' };
}
