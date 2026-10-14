import { describe, expect, it, vi } from 'vitest';
import { OpenAiResumeReviewer } from './openai-review.js';

const input = {
  segments: [{ line: 3, text: 'Built reports.' }],
  language: 'en-GB' as const,
  targetCountry: '',
  jobDescription: '',
};

const envelope = (content: string, finish_reason = 'stop') =>
  new Response(
    JSON.stringify({ choices: [{ finish_reason, message: { content, refusal: null } }] }),
  );

describe('bounded OpenAI writing adapter', () => {
  it('uses a fixed endpoint, nonstored structured output and no tools', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(envelope('{"findings":[]}'));
    const reviewer = new OpenAiResumeReviewer('synthetic-key', 'explicit-model', transport);

    expect(await reviewer.review(input, new AbortController().signal)).toEqual([]);
    expect(transport.mock.calls[0]![0]).toBe('https://api.openai.com/v1/chat/completions');

    const options = transport.mock.calls[0]![1]!;
    const body = JSON.parse(String(options.body));

    expect(options.redirect).toBe('error');

    expect(body).toMatchObject({
      store: false,
      model: 'explicit-model',
      max_completion_tokens: 3_000,
      response_format: { type: 'json_schema', json_schema: { strict: true } },
    });

    expect(body.tools).toBeUndefined();
    expect(body.messages[0].content).toContain('untrusted');
  });

  it.each([
    () => envelope('{"findings":[]}', 'length'),
    () => envelope('{"findings":[{"category":"invented"}]}'),
    () => new Response('private provider error', { status: 429 }),
    () => new Response('x'.repeat(128 * 1024 + 1)),
    () => envelope('{invalid json'),
  ])('returns a generic failure for incomplete, unsafe or oversized output', async (response) => {
    const reviewer = new OpenAiResumeReviewer(
      'synthetic-key',
      'explicit-model',
      vi.fn<typeof fetch>().mockResolvedValue(response()),
    );

    await expect(reviewer.review(input, new AbortController().signal)).rejects.toThrow(
      'Writing review unavailable',
    );
  });
});
