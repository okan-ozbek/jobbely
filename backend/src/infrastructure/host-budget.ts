import pg from 'pg';

export interface HostBudget {
  run<T>(
    host: string,
    operation: (signal: AbortSignal) => Promise<T>,
    intervalMs?: number,
  ): Promise<T>;
}

export class PostgresHostBudget implements HostBudget {
  private readonly pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString, max: 4, statement_timeout: 120_000 });
    this.pool.on('error', () => {});
  }

  async close() {
    await this.pool.end();
  }

  async run<T>(
    host: string,
    operation: (signal: AbortSignal) => Promise<T>,
    intervalMs = 1000,
  ): Promise<T> {
    const client = await this.pool.connect();
    const controller = new AbortController();

    const lost = (error: Error) => controller.abort(error);

    let locked = false;
    let discard = false;

    client.on('error', lost);

    try {
      // Session lock spans body consumption, but no SQL transaction spans network I/O.
      await client.query('SELECT pg_advisory_lock(hashtextextended($1, 721050))', [host]);
      locked = true;

      await client.query(
        'INSERT INTO "HttpHostBudget" ("host") VALUES ($1) ON CONFLICT DO NOTHING',
        [host],
      );

      const { rows } = await client.query<{ wait: number }>(
        `SELECT GREATEST(0, EXTRACT(EPOCH FROM (GREATEST("blockedUntil", "startedAt" + GREATEST("intervalMs", $2) * interval '1 millisecond') - clock_timestamp())) * 1000)::float8 AS wait FROM "HttpHostBudget" WHERE "host"=$1`,
        [host, intervalMs],
      );

      if (rows[0]!.wait > 30_000) {
        throw new Error('Shared host cooldown exceeds request budget; retry later');
      }

      await new Promise<void>((resolve) => setTimeout(resolve, Math.ceil(rows[0]!.wait)));
      controller.signal.throwIfAborted();

      await client.query(
        'UPDATE "HttpHostBudget" SET "startedAt"=clock_timestamp(), "intervalMs"=GREATEST("intervalMs",$2) WHERE "host"=$1',
        [host, intervalMs],
      );

      const result = await operation(controller.signal);

      controller.signal.throwIfAborted();

      return result;
    } catch (error) {
      discard = true;

      if (
        locked &&
        !controller.signal.aborted &&
        error instanceof Error &&
        'retryAfterMs' in error &&
        typeof error.retryAfterMs === 'number' &&
        Number.isFinite(error.retryAfterMs) &&
        error.retryAfterMs > 0
      ) {
        await client.query(
          `UPDATE "HttpHostBudget" SET "blockedUntil"=GREATEST("blockedUntil",clock_timestamp()+$2*interval '1 millisecond') WHERE "host"=$1`,
          [host, error.retryAfterMs],
        );
      }

      throw error;
    } finally {
      try {
        if (locked && !controller.signal.aborted) {
          // Completion spacing also covers retries performed inside the operation.
          await client.query(
            'UPDATE "HttpHostBudget" SET "startedAt"=clock_timestamp() WHERE "host"=$1',
            [host],
          );

          await client.query('SELECT pg_advisory_unlock(hashtextextended($1, 721050))', [host]);
        }
      } catch (error) {
        discard = true;

        throw error;
      } finally {
        client.removeListener('error', lost);
        client.release(discard || controller.signal.aborted);
      }
    }
  }
}
