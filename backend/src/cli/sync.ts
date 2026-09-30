import { bootstrap, config } from '../bootstrap.js';
import { parseArgs } from 'node:util';
import { selectSources } from './select-sources.js';

const { values } = parseArgs({
  options: {
    company: { type: 'string' },
    wave: { type: 'string' },
    'all-enabled': { type: 'boolean' },
  },
});

if (config.DATA_MODE !== 'postgres') {
  throw new Error(
    'Sync requires DATA_MODE=postgres. Demo data must stay separate from real vacancies.',
  );
}

const dependencies = await bootstrap();

try {
  const sources = selectSources(dependencies.companies, dependencies.sources, values);

  let failed = false;

  for (const source of sources) {
    try {
      console.log(JSON.stringify(await dependencies.sync.execute(source)));
    } catch (error) {
      failed = true;
      console.error(source.id, error instanceof Error ? error.message : error);
    }
  }

  if (failed) {
    process.exitCode = 1;
  }
} finally {
  await dependencies.repository.close();
}
