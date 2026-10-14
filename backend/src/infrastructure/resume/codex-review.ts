import { spawn } from 'node:child_process';
import type { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { z } from 'zod';
import type { ResumeWritingReviewer } from '../../ports/resume-review.js';
import { feedback, instructions } from './review-contract.js';

type Launch = (
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio,
) => ChildProcessWithoutNullStreams;

const disabledFeatures = [
  'shell_tool',
  'apps',
  'plugins',
  'remote_plugin',
  'hooks',
  'multi_agent',
  'browser_use',
  'browser_use_external',
  'browser_use_full_cdp_access',
  'browser_annotation_api',
  'computer_use',
  'in_app_browser',
  'code_mode_host',
];

function childEnvironment() {
  const environment: NodeJS.ProcessEnv = {};

  for (const key of [
    'PATH',
    'SystemRoot',
    'WINDIR',
    'USERPROFILE',
    'HOMEDRIVE',
    'HOMEPATH',
    'LOCALAPPDATA',
    'APPDATA',
    'TEMP',
    'TMP',
    'CODEX_HOME',
  ]) {
    if (process.env[key] !== undefined) {
      environment[key] = process.env[key];
    }
  }

  return environment;
}

function terminate(child: ChildProcessWithoutNullStreams) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  if (process.platform === 'win32' && child.pid) {
    const killer = spawn(
      join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'taskkill.exe'),
      ['/PID', String(child.pid), '/T', '/F'],
      { shell: false, windowsHide: true, stdio: 'ignore', timeout: 1_000 },
    );

    killer.once('error', () => child.kill('SIGKILL'));
    killer.once('exit', () => child.kill('SIGKILL'));
  } else {
    child.kill('SIGKILL');
  }
}

/** Personal localhost testing only. This process still sends text to OpenAI. */
export class CodexResumeReviewer implements ResumeWritingReviewer {
  readonly provider = 'codex-local';
  private active = false;

  constructor(
    private readonly command: string,
    private readonly model: string,
    private readonly launch: Launch = (command, args, options) =>
      spawn(command, args, { ...options, stdio: 'pipe' }),
    private readonly timeoutMs = 120_000,
  ) {}

  async review(input: Parameters<ResumeWritingReviewer['review']>[0], signal: AbortSignal) {
    signal.throwIfAborted();

    if (this.active) {
      throw new Error('Writing review unavailable');
    }

    this.active = true;

    let directory: string | undefined;

    try {
      directory = await mkdtemp(join(tmpdir(), 'jobbely-resume-review-'));

      const schema = join(directory, 'schema.json');

      await writeFile(schema, JSON.stringify(z.toJSONSchema(feedback, { target: 'draft-7' })), {
        mode: 0o600,
      });

      signal.throwIfAborted();

      const args = [
        'exec',
        '--model',
        this.model,
        '--ephemeral',
        '--ignore-user-config',
        '--skip-git-repo-check',
        '--sandbox',
        'read-only',
        '--json',
        '--color',
        'never',
        '--output-schema',
        schema,
        '-c',
        'web_search="disabled"',
        '-c',
        'model_reasoning_effort="low"',
        '-c',
        'analytics.enabled=false',
        '-c',
        'features.code_mode.enabled=false',
        ...disabledFeatures.flatMap((feature) => ['--disable', feature]),
        '-',
      ];

      const prompt = `${instructions}\nReview only the JSON data below. Do not use tools, browse, inspect files or execute commands. Return only the requested JSON.\n${JSON.stringify(input)}`;
      const deadline = AbortSignal.any([signal, AbortSignal.timeout(this.timeoutMs)]);

      const child = this.launch(this.command, args, {
        cwd: directory,
        env: childEnvironment(),
        shell: false,
        windowsHide: true,
      });

      return await new Promise<Awaited<ReturnType<ResumeWritingReviewer['review']>>>(
        (accept, reject) => {
          let bytes = 0;
          let pending = '';
          let message = '';
          let completed = false;
          let started = false;
          let failed = false;

          const stop = () => {
            if (!failed) {
              failed = true;
              terminate(child);
            }
          };

          const event = (line: string) => {
            if (!line.trim() || failed) {
              return;
            }

            try {
              const value = z
                .object({
                  type: z.string(),
                  item: z
                    .object({
                      type: z.string(),
                      text: z.string().optional(),
                      message: z.string().optional(),
                    })
                    .optional(),
                })
                .parse(JSON.parse(line));

              // This CLI reports the deliberately disabled host as a startup warning.
              // It confirms Code Mode will fail closed; other error items remain fatal.
              if (
                !started &&
                value.type === 'item.completed' &&
                value.item?.type === 'error' &&
                value.item.message ===
                  'Code Mode is unavailable because code-mode host is disabled. Code mode will fail closed; enable `features.code_mode_host` and install `codex-code-mode-host`.'
              ) {
                return;
              }

              if (
                value.type === 'error' ||
                value.type === 'turn.failed' ||
                (value.item && !['agent_message', 'reasoning'].includes(value.item.type))
              ) {
                stop();
              } else if (value.type === 'turn.completed') {
                completed = true;
              } else if (value.type === 'turn.started') {
                started = true;
              } else if (value.type === 'item.completed' && value.item?.type === 'agent_message') {
                message = value.item.text ?? '';
              }
            } catch {
              stop();
            }
          };

          child.stdout.setEncoding('utf8');

          child.stdout.on('data', (data: string) => {
            bytes += Buffer.byteLength(data);

            if (bytes > 256 * 1024) {
              stop();

              return;
            }

            pending += data;

            let end: number;

            while ((end = pending.indexOf('\n')) >= 0) {
              event(pending.slice(0, end));
              pending = pending.slice(end + 1);
            }
          });

          child.stderr.on('data', (data: Buffer) => {
            bytes += data.byteLength;

            if (bytes > 256 * 1024) {
              stop();
            }
          });

          child.stdin.once('error', stop);
          child.once('error', () => reject(new Error('Writing review unavailable')));
          deadline.addEventListener('abort', stop, { once: true });

          child.once('close', (code) => {
            deadline.removeEventListener('abort', stop);
            event(pending);

            try {
              deadline.throwIfAborted();

              if (failed || code !== 0 || !completed) {
                throw new Error('Writing review unavailable');
              }

              accept(feedback.parse(JSON.parse(message)).findings);
            } catch {
              reject(new Error('Writing review unavailable'));
            }
          });

          if (deadline.aborted) {
            stop();
          } else {
            child.stdin.end(prompt);
          }
        },
      );
    } catch {
      signal.throwIfAborted();

      throw new Error('Writing review unavailable');
    } finally {
      this.active = false;

      // Only remove the verified, schema-only temporary directory created by this call.
      if (
        directory &&
        dirname(resolve(directory)) === resolve(tmpdir()) &&
        basename(directory).startsWith('jobbely-resume-review-')
      ) {
        await rm(directory, { recursive: true, force: true });
      }
    }
  }
}
