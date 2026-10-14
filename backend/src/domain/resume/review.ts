export const reviewerVersion = 'review-1';

export interface ReviewLayout {
  format: 'pdf' | 'docx';
  pages: number | null;
  columnPages: number[];
  smallTextPages: number[];
  tableRows: number;
  contactInHeaderFooter: boolean;
}

export interface ResumeReviewInput {
  text: string;
  aiConsent: boolean;
  language: 'en-US' | 'en-GB' | 'nl-NL';
  targetCountry: string;
  jobDescription: string;
  layout?: ReviewLayout;
}

export interface ReviewFinding {
  id: string;
  source: 'rule' | 'ai';
  severity: 'error' | 'risk' | 'suggestion';
  category:
    | 'contact'
    | 'structure'
    | 'layout'
    | 'spelling'
    | 'grammar'
    | 'clarity'
    | 'impact'
    | 'relevance';
  title: string;
  explanation: string;
  suggestion: string;
  quote: string | null;
  line: number | null;
  page: number | null;
  rewrite: string | null;
}

export interface ResumeReview {
  version: typeof reviewerVersion;
  findings: ReviewFinding[];
  aiStatus: 'not_requested' | 'unavailable' | 'completed' | 'failed';
  limitations: string[];
}

export class ResumeReviewError extends Error {
  constructor(
    readonly code: 'invalid_review' | 'review_busy',
    message: string,
  ) {
    super(message);
  }
}

export const emailPattern = /[\w.!#$%&'*+/=?^`{|}~-]+@[\w-]+(?:\.[\w-]+)+/;

const phonePattern = /\+?\d[\d ()-]{7,}\d/g;

export function containsPhone(text: string): boolean {
  return [...text.matchAll(phonePattern)].some((match) => match[0].replace(/\D/g, '').length >= 9);
}

export function validateReviewInput(input: ResumeReviewInput) {
  if (
    !input.text.trim() ||
    input.text.length > 40_000 ||
    input.text.replace(/\r\n?/g, '\n').split('\n').length > 2_000
  ) {
    throw new ResumeReviewError(
      'invalid_review',
      'Use nonempty resume text up to 40,000 characters and 2,000 lines.',
    );
  }
}

export function reviewRules(input: ResumeReviewInput): ReviewFinding[] {
  validateReviewInput(input);

  const findings: ReviewFinding[] = [];
  const lines = input.text.replace(/\r\n?/g, '\n').split('\n');

  const add = (
    id: string,
    severity: ReviewFinding['severity'],
    category: ReviewFinding['category'],
    title: string,
    explanation: string,
    suggestion: string,
    line: number | null = null,
    page: number | null = null,
  ) => {
    findings.push({
      id,
      source: 'rule',
      severity,
      category,
      title,
      explanation,
      suggestion,
      quote: line === null ? null : lines[line - 1]!.slice(0, 600),
      line,
      page,
      rewrite: null,
    });
  };

  if (!emailPattern.test(input.text)) {
    add(
      'contact-email',
      'risk',
      'contact',
      'Check your email address',
      'No complete email address was detected. This may be an extraction problem or a missing contact method.',
      'Include a current email address and check its spelling.',
    );
  }

  if (!containsPhone(input.text)) {
    add(
      'contact-phone',
      'suggestion',
      'contact',
      'Check your contact options',
      'No phone number was detected. Contact requirements vary by application.',
      'Consider adding a phone number with a country code where appropriate.',
    );
  }

  if (
    !lines.some((line) =>
      /^(?:work experience|professional experience|experience|employment|education|skills|werkervaring|opleiding(?:en)?|vaardigheden)\s*:?$/i.test(
        line.trim(),
      ),
    )
  ) {
    add(
      'section-headings',
      'risk',
      'structure',
      'Make sections easy to find',
      'No common experience, education or skills heading was recognized.',
      'Use clear section headings in the language of your resume.',
    );
  }

  const bullets = lines
    .map((text, index) => ({ text, line: index + 1 }))
    .filter(({ text }) => /^\s*[•●▪*-]\s+/.test(text));

  const seen = new Set<string>();

  for (const bullet of bullets) {
    const normalized = bullet.text
      .replace(/^\s*[•●▪*-]\s+/, '')
      .trim()
      .toLowerCase();

    if (normalized.length > 30 && seen.has(normalized)) {
      add(
        `repetition-${bullet.line}`,
        'suggestion',
        'clarity',
        'Repeated bullet',
        'This bullet repeats an earlier description.',
        'Keep it if it adds distinct evidence; otherwise describe what was different in this role.',
        bullet.line,
      );
    }

    seen.add(normalized);

    if (bullet.text.length > 350) {
      add(
        `long-bullet-${bullet.line}`,
        'suggestion',
        'clarity',
        'A long bullet may be hard to scan',
        'This bullet contains more than 350 characters. This is a readability heuristic, not a hiring rule.',
        'Consider splitting it into concise statements while preserving useful detail.',
        bullet.line,
      );
    }
  }

  const bulletStyles = new Set(bullets.map(({ text }) => text.trim()[0]));

  if (bulletStyles.size > 1) {
    add(
      'bullet-consistency',
      'suggestion',
      'layout',
      'Check bullet consistency',
      'Different bullet markers were detected; extraction can also change markers.',
      'Use a consistent bullet style for comparable sections.',
    );
  }

  for (const [line, text] of lines.entries()) {
    const range = text.match(/\b((?:19|20)\d{2})\s*[-–—]\s*((?:19|20)\d{2})\b/);

    if (range && Number(range[1]) > Number(range[2])) {
      add(
        `reversed-dates-${line}`,
        'error',
        'structure',
        'Dates appear reversed',
        'The start year is later than the end year in this date range.',
        'Check the original document and correct the range if needed.',
        line + 1,
      );
    }
  }

  if (input.layout) {
    for (const page of input.layout.columnPages) {
      add(
        `columns-${page}`,
        'risk',
        'layout',
        'Possible columns',
        'The local reader inferred columns. Some application systems may read them in a different order.',
        'Check the reading order; consider a simple single-column version for uploads.',
        null,
        page,
      );
    }

    for (const page of input.layout.smallTextPages) {
      add(
        `small-text-${page}`,
        'suggestion',
        'layout',
        'Possibly small text',
        'The PDF contains predominantly small text heights. This estimates readability rather than measuring the original font size.',
        'Check this page at normal zoom and increase body text size if it is difficult to read.',
        null,
        page,
      );
    }

    if (input.layout.tableRows) {
      add(
        'tables',
        'risk',
        'layout',
        'Text in tables',
        'Table rows were found in the document. Some parsers may scramble their content.',
        'Check the extracted text; keep essential work history in ordinary paragraphs where practical.',
      );
    }

    if (input.layout.contactInHeaderFooter) {
      add(
        'header-contact',
        'risk',
        'layout',
        'Contact details in a header or footer',
        'Some application systems may miss contact details in these areas.',
        'Place essential contact details in the main document body as well.',
      );
    }
  }

  return findings.slice(0, 30);
}

/** Minimizes obvious contact data; does not promise complete anonymization. */
export function writingSegments(text: string) {
  let foundContent = false;

  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .flatMap((line, index) => {
      const value = line.trim();

      if (!value) {
        return [];
      }

      if (!foundContent) {
        foundContent = true;

        // Omit the first line, which commonly contains the candidate's name.
        return [];
      }

      if (
        emailPattern.test(value) ||
        containsPhone(value) ||
        /(?:https?:\/\/|www\.|linkedin\.com|github\.com)|^(?:address|adres|location|locatie|phone|tel(?:efoon)?|email)\s*:/i.test(
          value,
        )
      ) {
        return [];
      }

      return [{ line: index + 1, text: value }];
    });
}

export interface AiReviewFinding {
  category: 'spelling' | 'grammar' | 'clarity' | 'impact' | 'relevance';
  title: string;
  explanation: string;
  suggestion: string;
  quote: string;
  line: number;
  rewrite: string | null;
}

export function verifiedAiFindings(
  findings: AiReviewFinding[],
  segments: ReturnType<typeof writingSegments>,
): ReviewFinding[] {
  return findings.map((finding, index) => {
    const segment = segments.find((item) => item.line === finding.line);
    const numbers = finding.rewrite?.match(/\d+(?:[.,]\d+)?/g) ?? [];
    const sourceNumbers = new Set(finding.quote.match(/\d+(?:[.,]\d+)?/g) ?? []);

    if (
      !segment ||
      !finding.quote.trim() ||
      !segment.text.includes(finding.quote) ||
      numbers.some((number) => !sourceNumbers.has(number))
    ) {
      throw new ResumeReviewError('invalid_review', 'AI feedback could not be verified.');
    }

    return { ...finding, id: `ai-${index + 1}`, source: 'ai', severity: 'suggestion', page: null };
  });
}
