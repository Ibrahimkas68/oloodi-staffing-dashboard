/**
 * Copies text to the clipboard and says whether it worked.
 *
 * `navigator.clipboard` only exists in secure contexts, so it is undefined over plain http at a
 * non-localhost address (a phone on the same wifi). The fallback selects the text in a temporary
 * input and runs `document.execCommand('copy')`. Callers show the text for copying by hand when
 * this returns false.
 */
export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission denied or document not focused: try the fallback below.
    }
  }
  return copyWithSelection(text);
}

function copyWithSelection(text: string): boolean {
  const input = document.createElement('input');
  input.value = text;
  input.setAttribute('readonly', '');
  input.setAttribute('aria-hidden', 'true');
  // Off screen but selectable; 16px keeps iOS from zooming in on focus.
  input.style.cssText = 'position:fixed;top:0;left:-9999px;font-size:16px;opacity:0';
  document.body.appendChild(input);
  const previousFocus = document.activeElement as HTMLElement | null;
  try {
    input.focus();
    input.select();
    input.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    input.remove();
    previousFocus?.focus?.();
  }
}

/** The address of one worker's screen, for sharing: `/worker?worker=<worker id>`. */
export function workerLink(workerId: number, origin = window.location.origin): string {
  return `${origin}/worker?worker=${workerId}`;
}
