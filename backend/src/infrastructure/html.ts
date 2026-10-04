import { jobHeading } from '../domain/matching/document.js';
import { load } from 'cheerio';
import sanitizeHtml from 'sanitize-html';
import type { HtmlPreparation } from '../ports/ingestion.js';

export const htmlPreparation: HtmlPreparation = {
  prepare(input) {
    // Greenhouse can encode its HTML once. Decode text entities before applying the sanitizer.
    let decoded = input;

    if (!/<\/?[a-z][^>]*>/i.test(input) && /&(?:lt|#0*60|#x0*3c);/i.test(input)) {
      decoded = load(`<div>${input}</div>`)('div').text();
    }

    const html = sanitizeHtml(decoded, {
      allowedTags: [
        'p',
        'br',
        'ul',
        'ol',
        'li',
        'strong',
        'em',
        'b',
        'i',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'blockquote',
        'a',
        'div',
        'span',
      ],
      allowedAttributes: { a: ['href', 'title'] },
      allowedSchemes: ['https', 'http', 'mailto'],
      allowProtocolRelative: false,
      transformTags: {
        a: sanitizeHtml.simpleTransform('a', {
          rel: 'noopener noreferrer',
          target: '_blank',
        }),
      },
    });

    const document = load(html);

    // Standalone/leading emphasized section labels can precede an inline body.
    document('strong, b').each((_index, element) => {
      const label = document(element).text().trim();

      if (jobHeading(label) && document(element).parent().text().trimStart().startsWith(label)) {
        document(element).before('\n').after('\n');
      }
    });

    document('br').replaceWith('\n');
    document('p, div, li, h1, h2, h3, h4, h5, h6').prepend('\n').append('\n');

    return {
      html,
      text: document
        .root()
        .text()
        .replace(/[\t ]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim(),
    };
  },
};
