import type { Snapshot } from '@staffing/shared';
import { readinessSentence } from '../lib/readiness.js';
import { useNow } from '../lib/useNow.js';

/** The "starts in" part only changes by the minute. */
const REFRESH_MS = 30_000;

/** One plain sentence under the header: places filled, time to start, who still has to arrive. */
export function ReadinessLine({ snapshot }: { snapshot: Snapshot }) {
  const now = useNow(REFRESH_MS);
  return (
    <p data-testid="readiness-line" className="m-0 text-base text-mid">
      {readinessSentence(snapshot, now)}
    </p>
  );
}
