import { readFileSync } from 'node:fs';
import type * as FileSystem from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadRegistry } from './registry.js';

vi.mock('node:fs', async (original) => ({
  ...(await original<typeof FileSystem>()),
  readFileSync: vi.fn(),
}));

afterEach(() => vi.resetAllMocks());

function registry(board: string, provider = 'ashby', scheduled = false) {
  vi.mocked(readFileSync)
    .mockReturnValueOnce(
      JSON.stringify([
        { slug: 'example', name: 'Example', careersUrl: 'https://example.com/careers', wave: 'C' },
      ]),
    )
    .mockReturnValueOnce(
      JSON.stringify([
        {
          id: 'example',
          companySlug: 'example',
          provider,
          board,
          auditStatus: 'candidate',
          scheduled,
        },
      ]),
    );

  return loadRegistry();
}

describe('provider board identifiers', () => {
  it('accepts scheduled candidates without fabricating verification or approval evidence', () => {
    expect(registry('example', 'ashby', true).sources[0]).toMatchObject({
      auditStatus: 'candidate',
      scheduled: true,
    });

    expect(readFileSync).toHaveBeenCalledTimes(2);
  });

  it('preserves dotted Ashby names as a single configured board identifier', () => {
    expect(registry('example.ai').sources[0]?.board).toBe('example.ai');
  });

  it.each(['.example', 'example.', 'example..ai', 'example/ai', 'example?ai', 'example%2Eai'])(
    'rejects malformed or encoded Ashby board %s',
    (board) => {
      expect(() => registry(board)).toThrow('Invalid provider board identifier');
    },
  );

  it.each(['greenhouse', 'lever'])('keeps dotted identifiers invalid for %s', (provider) => {
    expect(() => registry('example.ai', provider)).toThrow('Invalid provider board identifier');
  });
});
