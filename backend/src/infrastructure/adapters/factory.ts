import type { Provider } from '../../domain/model.js';
import type { HtmlTransport, JsonSearchTransport, SourceAdapter } from '../../ports/ingestion.js';
import { AppleAdapter } from './apple.js';
import { AtlassianAdapter } from './atlassian.js';
import { ShopifyAdapter } from './shopify.js';
import { AmazonAdapter } from './amazon.js';
import { EightfoldAdapter } from './eightfold.js';
import { RestrictedAdapter } from './restricted.js';
import { AshbyAdapter } from './ashby.js';
import { GreenhouseAdapter } from './greenhouse.js';
import { IcimsAdapter } from './icims.js';
import { LeverAdapter } from './lever.js';
import { LinkedInAdapter } from './linkedin.js';
import { WorkdayAdapter } from './workday.js';

export function createAdapters(
  http: JsonSearchTransport & HtmlTransport,
): Readonly<Record<Provider, SourceAdapter>> {
  return {
    greenhouse: new GreenhouseAdapter(http),
    ashby: new AshbyAdapter(http),
    lever: new LeverAdapter(http),
    workday: new WorkdayAdapter(http),
    icims: new IcimsAdapter(http),
    linkedin: new LinkedInAdapter(),
    apple: new AppleAdapter(http),
    amazon: new AmazonAdapter(http),
    eightfold: new EightfoldAdapter(http),
    atlassian: new AtlassianAdapter(http),
    shopify: new ShopifyAdapter(http),
    meta: new RestrictedAdapter(
      'Meta integration blocked: its published robots policy requires express written permission for automated collection. Configure an authorized employer feed before extraction.',
    ),
    google: new RestrictedAdapter(
      'Google integration blocked: robots.txt disallows paginated career searches and no exhaustive authorized feed has been established. Obtain an authorized inventory before extraction; the first page is not complete coverage.',
    ),
  };
}
