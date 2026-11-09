import { useEffect, useState } from 'react';

/** Current time in ms, refreshed every `intervalMs` so relative labels ("synced 5s ago") stay true. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
