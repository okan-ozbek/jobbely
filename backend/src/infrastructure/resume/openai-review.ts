import { z } from 'zod';
import type { ResumeWritingReviewer } from '../../ports/resume-review.js';
import { feedback, instructions } from './review-contract.js';
import type { ResumeRoleAssessor } from '../../ports/resume-role-assessment.js';
import { roleFeedback, roleInstructions } from './role-contract.js';

export class OpenAiResumeReviewer implements ResumeWritingReviewer, ResumeRoleAssessor {
  readonly provider = 'openai-api';

  constructor(
    private readonly key: string,
    private readonly model: string,
    private readonly transport: typeof fetch = fetch,
  ) {}

  async review(input: Parameters<ResumeWritingReviewer['review']>[0], signal: AbortSignal) {
    return (await this.request(input, signal, feedback, instructions)).findings;
  }

  async assess(input: Parameters<ResumeRoleAssessor['assess']>[0], signal: AbortSignal) {
    return this.request(input, signal, roleFeedback, roleInstructions);
  }

  private async request<T>(
    input: unknown,
    signal: AbortSignal,
    schema: z.ZodType<T>,
    prompt: string,
  ): Promise<T> {
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
          { role: 'system', content: prompt },
          { role: 'user', content: JSON.stringify(input) },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'resume_review',
            strict: true,
            schema: z.toJSONSchema(schema, { target: 'draft-7' }),
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

      return schema.parse(JSON.parse(envelope.choices[0]!.message.content));
    } catch {
      throw new Error('Writing review unavailable');
    } finally {
      await reader.cancel();
    }
  }
}
