import { formatTime } from '../lib/format.js';
import { useLive } from '../lib/live.js';
import { useNow } from '../lib/useNow.js';

const SYNC_LABEL_REFRESH_MS = 1_000;

/**
 * C1 connection badge: filled pulsing dot (Live), half-filled dot (Reconnecting), hollow dot
 * (Offline). The word carries the meaning; the shape backs it up for colour-blind viewers.
 */
export function ConnectionBadge({ compact = false }: { compact?: boolean }) {
  const { status, lastSyncedAt } = useLive();
  const now = useNow(SYNC_LABEL_REFRESH_MS);
  const size = compact ? 'h-7 px-[11px] text-[13px] gap-1.5' : 'h-[38px] px-4 text-[15px] gap-2';
  const dot = compact ? 'size-2' : 'size-[9px]';

  let content;
  if (status === 'live') {
    const ago = lastSyncedAt ? Math.max(0, Math.round((now - lastSyncedAt) / 1_000)) : 0;
    content = (
      <>
        <span className={`relative inline-flex ${dot}`} aria-hidden="true">
          <span className="absolute inset-0 rounded-pill bg-live opacity-0 motion-safe:animate-pulse-dot" />
          <span className={`relative rounded-pill bg-live ${dot}`} />
        </span>
        <span className="font-semibold text-live">Live</span>
        <span className="text-shell-mid">· synced {ago}s ago</span>
      </>
    );
  } else if (status === 'offline') {
    content = (
      <>
        <span className={`rounded-pill border-[1.5px] border-shell-mid ${dot}`} aria-hidden="true" />
        <span className="font-semibold text-[#e8e9e4]">Offline</span>
        {lastSyncedAt && (
          <span className="text-shell-mid">, data from {formatTime(lastSyncedAt)}</span>
        )}
      </>
    );
  } else {
    content = (
      <>
        <span
          className={`rounded-pill border-[1.5px] border-warning bg-[linear-gradient(90deg,var(--color-warning)_50%,transparent_50%)] ${dot}`}
          aria-hidden="true"
        />
        <span className="font-semibold text-warning">{status === 'connecting' ? 'Connecting…' : 'Reconnecting…'}</span>
      </>
    );
  }

  return (
    <div
      data-testid="connection-status"
      data-status={status}
      role="status"
      className={`flex shrink-0 items-center whitespace-nowrap rounded-pill border border-shell-line bg-shell-raised ${size}`}
    >
      {content}
    </div>
  );
}

/** Shown on every screen while live updates are down. */
export function OfflineBanner({ layout = 'desktop' }: { layout?: 'desktop' | 'mobile' }) {
  const { status } = useLive();
  if (status === 'live' || status === 'connecting') return null;
  const shape =
    layout === 'desktop' ? 'mb-1 min-h-11 rounded-[14px] items-center px-4 text-[15px]' : 'items-start px-4 py-3 text-sm leading-[1.4]';
  return (
    <div role="status" className={`flex gap-3 bg-banner text-banner-fg animate-fade ${shape}`}>
      <span
        aria-hidden="true"
        className="mt-[3px] size-3 shrink-0 rounded-pill border-2 border-banner-dot bg-[linear-gradient(90deg,var(--color-banner-dot)_50%,transparent_50%)] sm:mt-0"
      />
      <span>
        <strong className="font-semibold">Live updates paused. Reconnecting…</strong> Actions may fail until
        we're back.
      </span>
    </div>
  );
}
