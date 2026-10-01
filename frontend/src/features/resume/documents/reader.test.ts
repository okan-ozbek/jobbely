import { describe, expect, it, vi } from 'vitest';
import { readLocalDocument, workerIsolationPolicy } from './reader.js';
import type { DocumentWorker } from './reader.js';

describe('isolated document session', () => {
  function setup() {
    const worker: DocumentWorker = {
      onmessage: null,
      onerror: null,
      postMessage: vi.fn(),
      terminate: vi.fn(),
    };

    const file = { size: 5, arrayBuffer: vi.fn(async () => new ArrayBuffer(5)) };
    const capabilities = { verify: vi.fn(async () => {}), createWorker: vi.fn(() => worker) };

    return { worker, file, capabilities };
  }

  it('requires enforced worker CSP and refuses relaxed or absent policies', () => {
    const strict = "default-src 'none'; script-src 'none'; connect-src 'none'; worker-src 'none'";

    expect(workerIsolationPolicy(strict, false)).toBe(true);

    expect(
      workerIsolationPolicy(strict.replace("script-src 'none'", "script-src 'self'"), false),
    ).toBe(false);

    expect(
      workerIsolationPolicy(strict.replace("connect-src 'none'", 'connect-src *'), false),
    ).toBe(false);

    expect(workerIsolationPolicy('', false)).toBe(false);
  });

  it('rejects unverified isolation before reading private bytes', async () => {
    const { file, capabilities } = setup();

    capabilities.verify.mockRejectedValue(new Error('unavailable'));

    await expect(
      readLocalDocument(file, 'pdf', new AbortController().signal, capabilities),
    ).rejects.toThrow('isolation');

    expect(file.arrayBuffer).not.toHaveBeenCalled();
    expect(capabilities.createWorker).not.toHaveBeenCalled();
  });

  it('cancels and terminates a worker, ignoring late output', async () => {
    const { worker, file, capabilities } = setup();
    const controller = new AbortController();
    const result = readLocalDocument(file, 'pdf', controller.signal, capabilities);
    const check = expect(result).rejects.toMatchObject({ name: 'AbortError' });

    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalled());
    controller.abort();
    await check;
    expect(worker.terminate).toHaveBeenCalledOnce();

    worker.onmessage?.({
      data: { result: { format: 'pdf', text: 'Late synthetic text', blocks: [], warnings: [] } },
    } as MessageEvent);
  });

  it('ignores parser readiness messages until the document result arrives', async () => {
    const { worker, file, capabilities } = setup();
    const reading = readLocalDocument(file, 'pdf', new AbortController().signal, capabilities);

    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalled());
    worker.onmessage?.({ data: { sourceName: 'worker', action: 'ready' } } as MessageEvent);

    const result = { format: 'pdf' as const, text: 'Synthetic', blocks: [], warnings: [] };

    worker.onmessage?.({ data: { result } } as MessageEvent);
    expect(await reading).toEqual(result);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('times out and terminates without a private error payload', async () => {
    const { worker, file, capabilities } = setup();

    await expect(
      readLocalDocument(file, 'pdf', new AbortController().signal, {
        ...capabilities,
        timeoutMs: 5,
      }),
    ).rejects.toThrow('30 seconds');

    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('cancellation during file reading never launches a worker', async () => {
    const { file, capabilities } = setup();
    const controller = new AbortController();

    let finish: (buffer: ArrayBuffer) => void = () => {};

    file.arrayBuffer.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );

    const result = readLocalDocument(file, 'docx', controller.signal, capabilities);
    const check = expect(result).rejects.toMatchObject({ name: 'AbortError' });

    await vi.waitFor(() => expect(file.arrayBuffer).toHaveBeenCalled());
    controller.abort();
    await check;
    finish(new ArrayBuffer(5));
    await Promise.resolve();
    expect(capabilities.createWorker).not.toHaveBeenCalled();
  });
});
