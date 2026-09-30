import type { Provider } from '../../domain/model.js';
import type { JsonSearchTransport, SourceAdapter } from '../../ports/ingestion.js';
import { AshbyAdapter } from './ashby.js';
import { GreenhouseAdapter } from './greenhouse.js';
import { IcimsAdapter } from './icims.js';
import { LeverAdapter } from './lever.js';
import { LinkedInAdapter } from './linkedin.js';
import { WorkdayAdapter } from './workday.js';

export function createAdapters(
  http: JsonSearchTransport,
): Readonly<Record<Provider, SourceAdapter>> {
  return {
    greenhouse: new GreenhouseAdapter(http),
    ashby: new AshbyAdapter(http),
    lever: new LeverAdapter(http),
    workday: new WorkdayAdapter(http),
    icims: new IcimsAdapter(http),
    linkedin: new LinkedInAdapter(),
  };
}
