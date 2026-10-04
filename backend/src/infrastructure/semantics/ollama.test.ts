import { describe, expect, it, vi } from 'vitest';
import { readJobDocument } from '../../domain/matching/document.js';
import type { SemanticDraft, SemanticJobInput } from '../../domain/matching/semantic-model.js';
import { SemanticExtractionError } from '../../ports/semantic-extractor.js';
import { OllamaJobExtractor } from './ollama.js';

const digest = 'a'.repeat(64);
const model = 'synthetic-local:4b';

const input: SemanticJobInput = {
  contentHash: 'synthetic',
  category: 'engineering',
  document: readJobDocument('Requirements\nExperience building resilient services.'),
};

const block = input.document.blocks.find((item) => item.kind !== 'heading')!;

function draft(): SemanticDraft {
  const source = { blockId: block.id, start: 0, end: block.text.length, quote: block.text };

  return {
    atoms: [
      {
        id: 'resilience',
        kind: 'capability',
        capability: {
          action: 'build',
          object: 'resilient services',
          domain: 'backend services',
          scope: 'production',
          tools: [],
          canonicalIds: [],
        },
        minimumMonths: null,
        durationScope: 'none',
        polarity: 'positive',
        source,
      },
    ],
    obligations: [
      {
        id: 'required-resilience',
        importance: 'required',
        expression: { kind: 'atom', atomId: 'resilience' },
        source,
      },
    ],
    blocks: [
      {
        blockId: block.id,
        interpretation: 'qualification',
        obligationIds: ['required-resilience'],
      },
    ],
  };
}

function transport(
  output: unknown = draft(),
  options: {
    changed?: boolean;
    remote?: boolean;
    incomplete?: boolean;
    wrongModel?: boolean;
    oversized?: boolean;
  } = {},
) {
  let tagReads = 0;

  return vi.fn<typeof fetch>(async (url) => {
    if (String(url).endsWith('/api/tags')) {
      return Response.json({
        models: [
          {
            name: model,
            digest: options.changed && ++tagReads > 2 ? 'b'.repeat(64) : digest,
            details: { quantization_level: 'Q4_K_M' },
            ...(options.remote ? { remote_host: 'https://example.invalid' } : {}),
          },
        ],
      });
    }

    return options.oversized
      ? new Response('x'.repeat(1_048_577))
      : Response.json({
          model: options.wrongModel ? 'wrong:4b' : model,
          done: true,
          done_reason: options.incomplete ? 'length' : 'stop',
          message: { role: 'assistant', content: JSON.stringify(output) },
        });
  });
}

describe('local semantic job extraction boundary', () => {
  it('uses a pinned local model with bounded structured output and validates exact source evidence', async () => {
    const fetch = transport();
    const extractor = await OllamaJobExtractor.create({ model, digest, fetch });
    const result = await extractor.extract(input);
    const call = fetch.mock.calls.find(([url]) => String(url).endsWith('/api/chat'))!;
    const payload = JSON.parse(String(call[1]!.body));

    expect(result).toMatchObject({
      contentHash: 'synthetic',
      state: 'interpreted',
      identity: { model: { digest, quantization: 'Q4_K_M' } },
    });

    expect(payload).toMatchObject({
      stream: false,
      think: false,
      keep_alive: 0,
      options: { num_ctx: 8192, num_predict: 4096, temperature: 0 },
    });

    expect(payload.tools).toBeUndefined();
    expect(call[1]!.redirect).toBe('error');
  });

  it.each([
    'https://example.invalid',
    'http://localhost:11434',
    'http://127.0.0.1.evil.invalid',
    'http://user:secret@127.0.0.1:11434',
    'http://127.0.0.1:11434/path',
  ])('rejects an unapproved model endpoint %s without fetching it', async (baseUrl) => {
    const fetch = transport();

    await expect(
      OllamaJobExtractor.create({ model, digest, baseUrl, fetch }),
    ).rejects.toMatchObject({ code: 'unavailable' });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects remote models and mismatched weight digests', async () => {
    await expect(
      OllamaJobExtractor.create({ model, digest, fetch: transport(undefined, { remote: true }) }),
    ).rejects.toMatchObject({ code: 'unavailable' });

    await expect(
      OllamaJobExtractor.create({ model, digest: 'c'.repeat(64), fetch: transport() }),
    ).rejects.toMatchObject({ code: 'model-changed' });
  });

  it.each([
    'quote',
    'span',
    'reference',
    'extra-field',
    'omitted-block',
    'unknown-id',
    'unattached-atom',
    'invented-years',
    'unsupported-duration',
  ] as const)(
    'rejects forged or invalid %s without exposing input/output in errors',
    async (failure) => {
      const output = draft();

      if (failure === 'quote') {
        output.atoms[0]!.source = { ...output.atoms[0]!.source, quote: 'PRIVATE FORGED PAYLOAD' };
      }

      if (failure === 'span') {
        output.atoms[0]!.source.end = 1000;
      }

      if (failure === 'reference') {
        output.obligations[0]!.expression = { kind: 'atom', atomId: 'forged' };
      }

      if (failure === 'extra-field') {
        Object.assign(output.atoms[0]!, { invented: 'PRIVATE FORGED PAYLOAD' });
      }

      if (failure === 'omitted-block') {
        output.blocks = [];
      }

      if (failure === 'unknown-id') {
        output.atoms[0]!.capability.canonicalIds = ['made-up'];
      }

      if (failure === 'unattached-atom') {
        output.atoms.push({ ...output.atoms[0]!, id: 'unused' });
      }

      if (failure === 'invented-years') {
        output.atoms[0]!.minimumMonths = 120;
      }

      if (failure === 'unsupported-duration') {
        Object.assign(output.atoms[0]!, {
          kind: 'experience',
          minimumMonths: 120,
          durationScope: 'activity',
        });
      }

      const extractor = await OllamaJobExtractor.create({
        model,
        digest,
        fetch: transport(output),
      });

      await expect(extractor.extract(input)).rejects.toEqual(
        new SemanticExtractionError('invalid-output'),
      );
    },
  );

  it.each([{ incomplete: true }, { oversized: true }, { wrongModel: true }, { changed: true }])(
    'rejects partial, oversized and changed-model responses: %o',
    async (options) => {
      const extractor = await OllamaJobExtractor.create({
        model,
        digest,
        fetch: transport(undefined, options),
      });

      await expect(extractor.extract(input)).rejects.toBeInstanceOf(SemanticExtractionError);
    },
  );

  it('bounds input before submitting it and respects cancellation', async () => {
    const fetch = transport();
    const extractor = await OllamaJobExtractor.create({ model, digest, fetch });
    const controller = new AbortController();

    controller.abort();

    await expect(extractor.extract(input, controller.signal)).rejects.toMatchObject({
      code: 'cancelled',
    });

    await expect(
      extractor.extract({ ...input, document: readJobDocument('x'.repeat(16_001)) }),
    ).rejects.toMatchObject({ code: 'input-limit' });

    expect(fetch.mock.calls).toHaveLength(1);
  });

  it('cancels an in-flight request and admits new work afterwards', async () => {
    const initial = transport();
    let firstChat = true;
    let started: (() => void) | undefined;

    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });

    const fetch = vi.fn<typeof globalThis.fetch>(async (url, options) => {
      if (!String(url).endsWith('/api/chat') || !firstChat) {
        return initial(url, options);
      }

      firstChat = false;
      started!();

      return new Promise<Response>((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => reject(new Error('private error')), {
          once: true,
        });
      });
    });

    const extractor = await OllamaJobExtractor.create({ model, digest, fetch });
    const controller = new AbortController();
    const running = extractor.extract(input, controller.signal);

    await ready;
    await expect(extractor.extract(input)).rejects.toMatchObject({ code: 'busy' });
    controller.abort();
    await expect(running).rejects.toMatchObject({ code: 'cancelled' });
    await expect(extractor.extract(input)).resolves.toMatchObject({ state: 'interpreted' });
  });

  it('enforces a deadline and returns generic errors for stalled inference', async () => {
    const initial = transport();

    const fetch = vi.fn<typeof globalThis.fetch>(async (url, options) => {
      if (!String(url).endsWith('/api/chat')) {
        return initial(url, options);
      }

      return new Promise<Response>((_resolve, reject) => {
        options?.signal?.addEventListener(
          'abort',
          () => reject(new Error('private runtime data')),
          { once: true },
        );
      });
    });

    const extractor = await OllamaJobExtractor.create({ model, digest, fetch, timeoutMs: 50 });

    await expect(extractor.extract(input)).rejects.toEqual(
      new SemanticExtractionError('unavailable'),
    );
  });

  it('treats source quotations as provenance rather than proof of semantic correctness', async () => {
    const output = draft();

    output.atoms[0]!.capability.object = 'compiler optimization';

    const extractor = await OllamaJobExtractor.create({ model, digest, fetch: transport(output) });

    // This structurally valid wrong interpretation needs independent semantic evaluation.
    expect((await extractor.extract(input)).atoms[0]!.capability.object).toBe(
      'compiler optimization',
    );
  });
});
