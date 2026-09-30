import { parseArgs } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { loadRegistry } from '../infrastructure/registry.js';
import { PublicJsonTransport } from '../infrastructure/http.js';
import { GreenhouseAdapter } from '../infrastructure/adapters/greenhouse.js';
import { AshbyAdapter } from '../infrastructure/adapters/ashby.js';
import { LeverAdapter } from '../infrastructure/adapters/lever.js';

const { values } = parseArgs({ options: { company: { type: 'string' } } });

if (!values.company) {
  throw new Error('Specify --company <slug>');
}

const { sources } = loadRegistry();
const matching = sources.filter((source) => source.companySlug === values.company);

if (!matching.length) {
  throw new Error('No configured sources for this company');
}

const transport = new PublicJsonTransport();

const adapters = {
  greenhouse: new GreenhouseAdapter(transport),
  ashby: new AshbyAdapter(transport),
  lever: new LeverAdapter(transport),
};

const directory = new URL('../../data/audits/', import.meta.url);

await mkdir(directory, { recursive: true });

for (const source of matching) {
  const at = new Date().toISOString();

  try {
    const extraction = await adapters[source.provider].extract(source);
    const ids = extraction.postings.map((posting) => posting.sourcePostingId);

    if (new Set(ids).size !== ids.length) {
      throw new Error('Duplicate posting IDs');
    }

    const report = {
      sourceId: source.id,
      at,
      adapterPayloadValidated: true,
      companyScopeVerified: false,
      vacancies: ids.length,
      excluded: extraction.excluded,
      enumerationComplete: extraction.enumerationComplete,
      sample: extraction.postings.slice(0, 3),
      rawResponses: extraction.rawResponses,
    };

    await writeFile(new URL(`${source.id}.json`, directory), JSON.stringify(report, null, 2));

    console.log(
      JSON.stringify({
        source: source.id,
        vacancies: ids.length,
        excluded: extraction.excluded,
        payload: 'validated',
        scope: 'pending review',
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    await writeFile(
      new URL(`${source.id}.json`, directory),
      JSON.stringify(
        {
          sourceId: source.id,
          at,
          adapterPayloadValidated: false,
          error: message,
        },
        null,
        2,
      ),
    );

    console.error(JSON.stringify({ source: source.id, error: message }));
    process.exitCode = 1;
  }
}
