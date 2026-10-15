import { Client } from 'pg';
import { PublicVocabularyAudit } from '../../domain/semantics/vocabulary-audit.js';
import type { AuditPosting } from '../../domain/semantics/vocabulary-audit.js';

export async function auditPublicVocabulary(connectionString: string) {
  const client = new Client({ connectionString });

  await client.connect();

  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');

    const revision = await client.query<{ version: number; featureGeneration: number }>(
      'SELECT "version", "featureGeneration" FROM "DatasetVersion" WHERE id = 1',
    );

    // Fetch only public current descriptions. Account, resume, raw provider and
    // posting-history tables are never read. Includes active and closed postings.
    const declaration = `DECLARE vocabulary_postings NO SCROLL CURSOR FOR
      SELECT id, "companySlug", category, coalesce(payload->>'descriptionText', '') AS "descriptionText"
      FROM "Posting" ORDER BY id`;

    const audit = new PublicVocabularyAudit();

    for (let pass = 0; pass < 2; pass++) {
      await client.query(declaration);

      while (true) {
        const batch = await client.query<AuditPosting>('FETCH 250 FROM vocabulary_postings');

        if (!batch.rows.length) {
          break;
        }

        for (const posting of batch.rows) {
          audit.add(posting);
        }
      }

      await client.query('CLOSE vocabulary_postings');

      if (pass === 0) {
        audit.startReview();
      }
    }

    await client.query('COMMIT');

    return { generatedAt: new Date().toISOString(), snapshot: revision.rows[0], ...audit.report() };
  } finally {
    await client.end();
  }
}
