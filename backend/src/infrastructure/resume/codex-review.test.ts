import { spawn } from 'node:child_process';
import type { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CodexResumeReviewer } from './codex-review.js';
import { createResumeWritingReviewer } from './reviewer-factory.js';

const input = {
  segments: [{ line: 3, text: '- Built a fictional dashboard.' }],
  language: 'en-GB' as const,
  targetCountry: '',
  jobDescription: '',
};

const result = {
  findings: [
    {
      category: 'clarity',
      title: 'Explain the contribution',
      explanation: 'The purpose of the dashboard is missing.',
      suggestion: 'Describe what the dashboard helped people do.',
      quote: '- Built a fictional dashboard.',
      line: 3,
      rewrite: null,
    },
  ],
};

const events = (content: unknown = result) =>
  [
    { type: 'thread.started' },
    { type: 'turn.started' },
    { type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify(content) } },
    { type: 'turn.completed' },
  ]
    .map((event) => JSON.stringify(event))
    .join('\n');

function fixture(output: string, tail = '') {
  return (_command: string, _args: string[], options: SpawnOptionsWithoutStdio) =>
    spawn(
      process.execPath,
      [
        '-e',
        `process.stdin.resume();process.stdin.on('end',()=>{process.stdout.write(${JSON.stringify(output)});${tail}});`,
      ],
      { ...options, stdio: 'pipe' },
    );
}

afterEach(() => vi.unstubAllEnvs());

describe('isolated local Codex writing adapter', () => {
  it('uses stdin, an isolated schema-only directory, disabled tools and a restricted environment', async () => {
    vi.stubEnv('DATABASE_URL', 'synthetic-database-secret');
    vi.stubEnv('RESUME_REVIEW_OPENAI_KEY', 'synthetic-api-secret');

    let directory = '';

    const launch = vi.fn((command: string, args: string[], options: SpawnOptionsWithoutStdio) => {
      directory = String(options.cwd);
      expect(readdirSync(directory)).toEqual(['schema.json']);

      expect(JSON.parse(readFileSync(join(directory, 'schema.json'), 'utf8')).required).toEqual([
        'findings',
      ]);

      expect(args).toContain('--ephemeral');
      expect(args).toContain('--ignore-user-config');
      expect(args).toContain('read-only');
      expect(args).toContain('shell_tool');
      expect(args).toContain('code_mode_host');
      expect(args).toContain('features.code_mode.enabled=false');
      expect(args).toContain('gpt-6.1-sol');
      expect(args.join(' ')).not.toContain('fictional dashboard');
      expect(options).toMatchObject({ shell: false, windowsHide: true });
      expect(options.env?.DATABASE_URL).toBeUndefined();
      expect(options.env?.RESUME_REVIEW_OPENAI_KEY).toBeUndefined();

      return spawn(
        process.execPath,
        [
          '-e',
          `let prompt='';process.stdin.setEncoding('utf8');process.stdin.on('data',chunk=>prompt+=chunk);process.stdin.on('end',()=>{if(!prompt.includes('fictional dashboard')||!prompt.includes('untrusted'))process.exit(1);process.stdout.write(${JSON.stringify(events())});});`,
        ],
        { ...options, stdio: 'pipe' },
      );
    });

    const reviewer = new CodexResumeReviewer(process.execPath, 'gpt-6.1-sol', launch);

    expect(await reviewer.review(input, new AbortController().signal)).toEqual(result.findings);
    expect(existsSync(directory)).toBe(false);
  });

  it.each([
    ['incomplete turn', events().split('\n').slice(0, -1).join('\n'), ''],
    ['nonzero exit', events(), 'process.exitCode=1;'],
    ['invalid JSON', '{not JSON}\n', ''],
    ['invalid schema', events({ findings: [{ category: 'invented' }] }), ''],
    [
      'tool execution',
      JSON.stringify({ type: 'item.started', item: { type: 'command_execution' } }) +
        '\n' +
        events(),
      'setInterval(()=>{},1000);',
    ],
    [
      'provider failure',
      JSON.stringify({ type: 'turn.failed', error: { message: 'synthetic private error' } }) +
        '\n' +
        events(),
      '',
    ],
    [
      'oversized output',
      '',
      "process.stdout.write('x'.repeat(256 * 1024 + 1));setInterval(()=>{},1000);",
    ],
    [
      'oversized diagnostics',
      events(),
      "process.stderr.write('x'.repeat(256 * 1024 + 1));setInterval(()=>{},1000);",
    ],
  ])('rejects %s without reflecting process output', async (_name, output, tail) => {
    const reviewer = new CodexResumeReviewer(
      process.execPath,
      'gpt-6.1-sol',
      fixture(output, tail),
    );

    await expect(reviewer.review(input, new AbortController().signal)).rejects.toThrow(
      'Writing review unavailable',
    );
  });

  it('accepts only the exact startup warning for the deliberately disabled Code Mode host', async () => {
    const warning = {
      type: 'item.completed',
      item: {
        type: 'error',
        message:
          'Code Mode is unavailable because code-mode host is disabled. Code mode will fail closed; enable `features.code_mode_host` and install `codex-code-mode-host`.',
      },
    };

    const reviewer = new CodexResumeReviewer(
      process.execPath,
      'gpt-6.1-sol',
      fixture(JSON.stringify(warning) + '\n' + events()),
    );

    expect(await reviewer.review(input, new AbortController().signal)).toEqual(result.findings);

    const failed = new CodexResumeReviewer(
      process.execPath,
      'gpt-6.1-sol',
      fixture(
        JSON.stringify({ ...warning, item: { type: 'error', message: 'A different failure' } }) +
          '\n' +
          events(),
      ),
    );

    await expect(failed.review(input, new AbortController().signal)).rejects.toThrow(
      'Writing review unavailable',
    );
  });

  it('kills timed-out processes and cleans their directory', async () => {
    let child: ChildProcessWithoutNullStreams | undefined;
    let directory = '';

    const launch = (command: string, args: string[], options: SpawnOptionsWithoutStdio) => {
      directory = String(options.cwd);
      child = fixture('', 'setInterval(()=>{},1000);')(command, args, options);

      return child;
    };

    const reviewer = new CodexResumeReviewer(process.execPath, 'gpt-6.1-sol', launch, 100);

    await expect(reviewer.review(input, new AbortController().signal)).rejects.toThrow(
      'Writing review unavailable',
    );

    expect(child?.exitCode !== null || child?.signalCode !== null).toBe(true);
    expect(existsSync(directory)).toBe(false);
  });

  it('cancels the process, refuses a concurrent review, and releases admission', async () => {
    const controller = new AbortController();
    const started = Promise.withResolvers<void>();
    let calls = 0;

    const launch = (command: string, args: string[], options: SpawnOptionsWithoutStdio) => {
      const child =
        calls++ === 0
          ? fixture('', 'setInterval(()=>{},1000);')(command, args, options)
          : fixture(events())(command, args, options);

      started.resolve();

      return child;
    };

    const reviewer = new CodexResumeReviewer(process.execPath, 'gpt-6.1-sol', launch);
    const running = reviewer.review(input, controller.signal);
    const cancelled = expect(running).rejects.toThrow('This operation was aborted');

    await started.promise;

    await expect(reviewer.review(input, new AbortController().signal)).rejects.toThrow(
      'Writing review unavailable',
    );

    controller.abort();
    await cancelled;
    expect(await reviewer.review(input, new AbortController().signal)).toEqual(result.findings);
  });

  it('handles missing executables and cancellation before launching', async () => {
    const launch = vi.fn(fixture(events()));
    const controller = new AbortController();

    controller.abort();

    await expect(
      new CodexResumeReviewer('missing', 'gpt-6.1-sol', launch).review(input, controller.signal),
    ).rejects.toThrow('This operation was aborted');

    expect(launch).not.toHaveBeenCalled();

    await expect(
      new CodexResumeReviewer(join(process.cwd(), 'nonexistent-codex.exe'), 'gpt-6.1-sol').review(
        input,
        new AbortController().signal,
      ),
    ).rejects.toThrow('Writing review unavailable');
  });
});

describe('resume provider configuration', () => {
  const settings = {
    RESUME_REVIEW_PROVIDER: 'codex-local' as const,
    RESUME_REVIEW_MODEL: 'gpt-6.1-sol',
    RESUME_REVIEW_CODEX_COMMAND: process.execPath,
    NODE_ENV: 'development',
    HOST: '127.0.0.1',
    FRONTEND_ORIGIN: 'http://127.0.0.1:5173',
  };

  it('selects local Codex while preserving the optional API provider', () => {
    expect(createResumeWritingReviewer(settings)?.provider).toBe('codex-local');

    expect(
      createResumeWritingReviewer({
        ...settings,
        RESUME_REVIEW_PROVIDER: 'openai-api',
        RESUME_REVIEW_MODEL: undefined,
      }),
    ).toBeUndefined();

    expect(
      createResumeWritingReviewer({
        ...settings,
        RESUME_REVIEW_PROVIDER: 'openai-api',
        RESUME_REVIEW_OPENAI_KEY: 'synthetic-key',
      })?.provider,
    ).toBe('openai-api');
  });

  it.each([
    { NODE_ENV: 'production' },
    { HOST: '0.0.0.0' },
    { FRONTEND_ORIGIN: 'https://example.invalid' },
    { RESUME_REVIEW_MODEL: undefined },
    { RESUME_REVIEW_CODEX_COMMAND: 'codex' },
  ])('refuses unsafe or incomplete local configuration: %j', (override) => {
    expect(() => createResumeWritingReviewer({ ...settings, ...override })).toThrow();
  });
});
