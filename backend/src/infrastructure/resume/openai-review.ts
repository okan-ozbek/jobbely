import { z } from 'zod';
import type { ResumeWritingReviewer } from '../../ports/resume-review.js';
import { feedback, instructions } from './review-contract.js';

export class OpenAiResumeReviewer implements ResumeWritingReviewer {
  readonly provider = 'openai-api';

  constructor(
    private readonly key: string,
    private readonly model: string,
    private readonly transport: typeof fetch = fetch,
  ) {}

  async review(input: Parameters<ResumeWritingReviewer['review']>[0], signal: AbortSignal) {
    signal.throwIfAborted();

    const deadline = AbortSignal.any([signal, AbortSignal.timeout(30_000)]);

    const response = await this.transport('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      redirect: 'error',
      signal: deadline,
      headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        store: false,
        max_completion_tokens: 3_000,
        messages: [
          { role: 'system', content: instructions },
          { role: 'user', content: JSON.stringify(input) },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'resume_review',
            strict: true,
            schema: z.toJSONSchema(feedback, { target: 'draft-7' }),
          },
        },
      }),
    });

    if (!response.ok || !response.body) {
      await response.body?.cancel();

      throw new Error('Writing review unavailable');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    let body = '';

    try {
      while (true) {
        const chunk = await reader.read();

        if (chunk.done) {
          break;
        }

        bytes += chunk.value.byteLength;

        if (bytes > 128 * 1024) {
          throw new Error('Writing review response exceeds limit');
        }

        body += decoder.decode(chunk.value, { stream: true });
      }

      body += decoder.decode();
      deadline.throwIfAborted();

      const envelope = z
        .object({
          choices: z
            .array(
              z.object({
                finish_reason: z.literal('stop'),
                message: z.object({ content: z.string(), refusal: z.null().optional() }),
              }),
            )
            .length(1),
        })
        .parse(JSON.parse(body));

      return feedback.parse(JSON.parse(envelope.choices[0]!.message.content)).findings;
    } catch {
      throw new Error('Writing review unavailable');
    } finally {
      await reader.cancel();
    }
  }
}
