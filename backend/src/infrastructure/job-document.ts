import { load } from 'cheerio';
import { readJobDocument, jobHeading, informationRole } from '../domain/matching/document.js';
import type { JobDocumentReader } from '../ports/job-document.js';
import { htmlPreparation } from './html.js';

export const htmlJobDocumentReader: JobDocumentReader = {
  read({ descriptionText, descriptionHtml }) {
    if (!descriptionHtml || !/<\/?[a-z][^>]*>/i.test(descriptionHtml)) {
      return readJobDocument(descriptionText);
    }

    if (descriptionHtml.length > 2_000_000) {
      return readJobDocument(' '.repeat(200_001));
    }

    const prepared = htmlPreparation.prepare(descriptionHtml);
    const result = readJobDocument(prepared.text);
    const dom = load(prepared.html);
    const headings: { text: string; level: number }[] = [];

    dom('h1,h2,h3,h4,h5,h6,strong,b').each((_index, element) => {
      const label = dom(element).text().trim();
      const tag = element.tagName;

      if (
        /^h[1-6]$/.test(tag) ||
        (jobHeading(label) && dom(element).parent().text().trimStart().startsWith(label))
      ) {
        headings.push({ text: label, level: /^h/.test(tag) ? Number(tag[1]) : 2 });
      }
    });

    const ancestry: { text: string; level: number }[] = [];
    let search = 0;

    let section = { role: 'unknown', importance: 'contextual' } as Pick<
      (typeof result.blocks)[number],
      'role' | 'importance'
    >;

    for (const block of result.blocks) {
      const headingIndex = headings.findIndex(
        (heading, index) => index >= search && heading.text === block.text.trim(),
      );

      if (headingIndex >= 0) {
        const heading = headings[headingIndex]!;

        search = headingIndex + 1;

        while (ancestry.length && ancestry.at(-1)!.level >= heading.level) {
          ancestry.pop();
        }

        ancestry.push(heading);
        section = jobHeading(heading.text) ?? section;
        block.kind = 'heading';
      } else if (block.kind === 'heading') {
        section = jobHeading(block.text) ?? section;
        ancestry.length = 0;
        ancestry.push({ text: block.text.trim(), level: 2 });
      }

      block.headingPath = ancestry.map((heading) => heading.text);
      block.role = informationRole(block.text) ?? section.role;

      block.importance = ['application', 'benefits', 'compensation', 'legal', 'overview'].includes(
        block.role,
      )
        ? 'contextual'
        : section.importance;
    }

    return result;
  },
};
