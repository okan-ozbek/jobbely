import { bootstrap, config } from '../bootstrap.js';

if (config.DATA_MODE !== 'postgres') {
  throw new Error('Feature backfill requires DATA_MODE=postgres.');
}

const dependencies = await bootstrap();

try {
  console.log(JSON.stringify(await dependencies.backfill.execute()));
} finally {
  await dependencies.closeFeatures();
  await dependencies.repository.close();
}
