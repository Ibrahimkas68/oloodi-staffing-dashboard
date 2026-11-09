import { Brand } from '../components/Brand.js';
import { ConnectionBadge, OfflineBanner } from '../components/Connection.js';
import { useLive } from '../lib/live.js';

/**
 * Worker view shell from docs/design/WorkerView.dc.html (mobile first). The picker, status card
 * and actions come with User Story 2.
 */
export function WorkerPage() {
  const { snapshot } = useLive();

  return (
    <div className="mx-auto flex min-h-screen max-w-[480px] flex-col bg-surface text-ink">
      <div className="flex flex-col gap-3.5 bg-shell px-4 pt-4 pb-4 text-shell-text">
        <div className="flex items-center justify-between gap-3">
          <Brand size="sm" />
          <ConnectionBadge compact />
        </div>
      </div>
      <OfflineBanner layout="mobile" />
      <div className="flex flex-col gap-3 p-4">
        <p className="text-mid">{snapshot ? snapshot.shift.title : 'Loading your shift…'}</p>
      </div>
    </div>
  );
}
