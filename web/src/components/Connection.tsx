import { formatTime } from '../lib/format.js';
import { useLive } from '../lib/live.js';
import { useNow } from '../lib/useNow.js';

const SYNC_LABEL_REFRESH_MS = 1_000;

/**
 * C1 connection badge: filled pulsing dot (Live), half-filled dot (Reconnecting), hollow dot
 * (Offline). The word carries the meaning; the shape backs it up for colour-blind viewers.
 */
export function ConnectionBadge({ size = 'default' }: { size?: 'default' | 'phone' }) {
  const { status, lastSyncedAt } = useLive();
  const now = useNow(SYNC_LABEL_REFRESH_MS);
  // "phone" is the small badge of the worker header, and grows to the default from `md` up.
  const box = size === 'phone' ? 'h-7 gap-1.5 px-[11px] text-[13px] md:h-[38px] md:gap-2 md:px-4 md:text-[15px]' : 'h-[38px] gap-2 px-4 text-[15px]';
  const dot = size === 'phone' ? 'size-2 md:size-[9px]' : 'size-[9px]';

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
      className={`flex shrink-0 items-center whitespace-nowrap rounded-pill border border-shell-line bg-shell-raised ${box}`}
    >
      {content}
    </div>
  );
}

type BannerLayout = 'desktop' | 'mobile' | 'adaptive';

/**
 * Banner shapes: a rounded strip on the desktop shell, a full-width band on phones, and
 * "adaptive" for pages that serve both (a band under the header, a strip above it from `md`).
 */
const BANNER_SHAPE: Record<BannerLayout, { box: string; dot: string }> = {
  desktop: { box: 'mb-1 min-h-11 items-center rounded-[14px] px-4 text-[15px]', dot: '' },
  mobile: { box: 'items-start px-4 py-3 text-sm leading-[1.4]', dot: 'mt-[3px]' },
  adaptive: {
    box: 'order-2 items-start px-4 py-3 text-sm leading-[1.4] md:order-1 md:mb-1 md:min-h-11 md:items-center md:rounded-[14px] md:py-0 md:text-[15px]',
    dot: 'mt-[3px] md:mt-0',
  },
};

/**
 * Shown on every screen while live updates are down. The status region stays in the page (it takes
 * no space) so the banner is announced when it appears.
 */
export function OfflineBanner({ layout = 'desktop' }: { layout?: BannerLayout }) {
  const { status } = useLive();
  const paused = status !== 'live' && status !== 'connecting';
  const shape = BANNER_SHAPE[layout];
  return (
    <div role="status" className="contents">
      {paused && (
        <div className={`flex gap-3 bg-banner text-banner-fg animate-fade ${shape.box}`}>
          <span
            aria-hidden="true"
            className={`size-3 shrink-0 rounded-pill border-2 border-banner-dot bg-[linear-gradient(90deg,var(--color-banner-dot)_50%,transparent_50%)] ${shape.dot}`}
          />
          <span>
            <strong className="font-semibold">Live updates paused. Reconnecting…</strong> Actions may fail until
            we're back.
          </span>
        </div>
      )}
    </div>
  );
}
