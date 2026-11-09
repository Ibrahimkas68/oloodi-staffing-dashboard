import { copyText, workerLink } from '../lib/copyText.js';
import { useToast } from './Toasts.js';

/**
 * Icon button that copies one worker's link. Works over plain http too (see `copyText`); when
 * copying is impossible it hands the link to `onManualCopy`, which shows it for copying by hand.
 */
export function CopyLinkButton({
  workerId,
  workerName,
  onManualCopy,
}: {
  workerId: number;
  workerName: string;
  onManualCopy: (link: string) => void;
}) {
  const toast = useToast();

  async function copy() {
    const link = workerLink(workerId);
    if (await copyText(link)) toast('success', `Link for ${workerName} copied`);
    else onManualCopy(link);
  }

  return (
    <button
      type="button"
      title="Copy worker link"
      aria-label={`Copy worker link for ${workerName}`}
      onClick={() => void copy()}
      className="inline-flex size-[34px] shrink-0 cursor-pointer items-center justify-center rounded-sm border border-avatar bg-card p-0 text-mid transition-colors duration-150 hover:bg-line-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-ink"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="5.5" y="5.5" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M10.5 3.5V3.2A1.7 1.7 0 0 0 8.8 1.5H4.2A1.7 1.7 0 0 0 2.5 3.2v4.6a1.7 1.7 0 0 0 1.7 1.7h.3"
          stroke="currentColor"
          strokeWidth="1.4"
        />
      </svg>
    </button>
  );
}

/** Shown when the browser refused every way of copying: the link, selected, ready to copy by hand. */
export function ManualCopyField({ link, onClose }: { link: string; onClose: () => void }) {
  return (
    <div
      role="group"
      aria-label="Copy the worker link by hand"
      className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-card p-3"
    >
      <label htmlFor="manual-link" className="text-sm text-mid">
        Copying is blocked here. Select the link and copy it:
      </label>
      <input
        id="manual-link"
        readOnly
        value={link}
        autoFocus
        onFocus={(event) => event.currentTarget.select()}
        className="h-[34px] min-w-0 flex-1 basis-64 rounded-sm border border-avatar bg-surface px-2.5 text-sm text-ink"
      />
      <button
        type="button"
        onClick={onClose}
        className="h-[34px] cursor-pointer rounded-sm border border-avatar bg-card px-3 text-sm font-medium text-ink hover:bg-line-soft"
      >
        Done
      </button>
    </div>
  );
}
