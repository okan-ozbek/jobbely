import { parseArgs } from 'node:util';
import { bootstrap } from '../bootstrap.js';
import { supportedFunctions } from '../domain/matching/requirements.js';

const { values } = parseArgs({ options: { samples: { type: 'string', default: '3' } } });
const samples = Number(values.samples);

if (!Number.isInteger(samples) || samples < 1 || samples > 10) {
  throw new Error('Samples must be between 1 and 10');
}

const app = await bootstrap();

try {
  for (let sample = 1; sample <= samples; sample++) {
    for (const categories of [['engineering'], supportedFunctions]) {
      const started = performance.now();

      const result = await app.matcher.execute({
        profile: {
          analysisDate: new Date().toISOString().slice(0, 10),
          skills: [{ id: 'typescript', status: 'user_confirmed' }],
          employment: [],
          location: { value: '', status: 'unknown' },
        },
        categories,
        employerContext: false,
        limit: 20,
      });

      console.log(
        JSON.stringify({
          operation: 'matching',
          sample,
          categories,
          ms: Math.round(performance.now() - started),
          eligible: result.eligible,
          evaluated: result.evaluated,
          unenriched: result.unenriched,
          items: result.items.length,
        }),
      );
    }

    for (const query of [{}, { q: 'TypeScript' }, { q: '%' }]) {
      const started = performance.now();
      const result = await app.catalog.jobs({ ...query, limit: 20 });

      console.log(
        JSON.stringify({
          operation: 'catalog',
          sample,
          query,
          ms: Math.round(performance.now() - started),
          total: result.total,
          items: result.items.length,
        }),
      );
    }
  }
} finally {
  await app.closeFeatures();
  await app.closeAccounts();
  await app.repository.close();
}
