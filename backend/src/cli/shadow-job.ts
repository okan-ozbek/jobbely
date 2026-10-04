import { parseArgs } from 'node:util';
import { bootstrap, config } from '../bootstrap.js';
import { createSemanticJobShadow } from '../bootstrap-semantics.js';
import { htmlJobDocumentReader } from '../infrastructure/job-document.js';
import { SemanticExtractionError } from '../ports/semantic-extractor.js';

const { values } = parseArgs({ options: { job: { type: 'string' } } });

if (!values.job || config.DATA_MODE !== 'postgres') {
  throw new Error('Use --job <stored-public-posting-id> with DATA_MODE=postgres.');
}

const controller = new AbortController();

const cancel = () => controller.abort();

process.once('SIGINT', cancel);

try {
  const shadow = createSemanticJobShadow();
  const dependencies = await bootstrap();

  try {
    const job = await dependencies.catalog.job(values.job);

    if (!job) {
      throw new Error('Public posting not found.');
    }

    const result = await shadow.execute(
      {
        contentHash: job.contentHash,
        category: job.classification.category,
        document: htmlJobDocumentReader.read(job),
      },
      controller.signal,
    );

    console.log(JSON.stringify({ postingId: job.id, ...result }, null, 2));

    if (result.state !== 'compared') {
      process.exitCode = 1;
    }
  } finally {
    await dependencies.closeFeatures();
    await dependencies.repository.close();
  }
} catch (error) {
  console.error(
    JSON.stringify({
      code: controller.signal.aborted
        ? 'cancelled'
        : error instanceof SemanticExtractionError
          ? error.code
          : 'shadow-failed',
      message:
        'Could not compare public-job extraction. Check the posting, database and pinned local model configuration.',
    }),
  );

  process.exitCode = 1;
} finally {
  process.removeListener('SIGINT', cancel);
}
