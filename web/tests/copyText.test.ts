import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText, workerLink } from '../src/lib/copyText.js';

/** A stand-in for the temporary input: records what the fallback does to it. */
function fakeDocument(copyResult: boolean | Error) {
  const input = {
    style: {} as Record<string, string>,
    value: '',
    setAttribute: vi.fn(),
    focus: vi.fn(),
    select: vi.fn(),
    setSelectionRange: vi.fn(),
    remove: vi.fn(),
  };
  const execCommand = vi.fn(() => {
    if (copyResult instanceof Error) throw copyResult;
    return copyResult;
  });
  const document = {
    createElement: vi.fn(() => input),
    body: { appendChild: vi.fn() },
    activeElement: null,
    execCommand,
  };
  return { input, document, execCommand };
}

describe('copyText', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the clipboard API when it exists', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await copyText('hello')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('falls back to a selected temporary input when navigator.clipboard is undefined (plain http)', async () => {
    const { input, document, execCommand } = fakeDocument(true);
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('document', document);
    expect(await copyText('http://192.168.1.5:3000/worker?worker=2')).toBe(true);
    expect(input.value).toBe('http://192.168.1.5:3000/worker?worker=2');
    expect(input.select).toHaveBeenCalled();
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(input.remove).toHaveBeenCalled();
  });

  it('falls back when the clipboard API rejects', async () => {
    const { document, execCommand } = fakeDocument(true);
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    vi.stubGlobal('document', document);
    expect(await copyText('x')).toBe(true);
    expect(execCommand).toHaveBeenCalled();
  });

  it('returns false, and cleans up, when every way fails', async () => {
    const refused = fakeDocument(false);
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('document', refused.document);
    expect(await copyText('x')).toBe(false);
    expect(refused.input.remove).toHaveBeenCalled();

    const thrown = fakeDocument(new Error('blocked'));
    vi.stubGlobal('document', thrown.document);
    expect(await copyText('x')).toBe(false);
    expect(thrown.input.remove).toHaveBeenCalled();
  });
});

describe('workerLink', () => {
  it('points at the worker view with the worker id', () => {
    expect(workerLink(2, 'http://192.168.1.5:3000')).toBe(
      'http://192.168.1.5:3000/worker?worker=2',
    );
  });
});
