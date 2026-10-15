import { readJobDocument } from '../matching/document.js';
import { recognizeConcepts } from './recognize.js';
import { registryVersion } from './concepts.js';

export interface AuditPosting {
  id: string;
  companySlug: string;
  category: string;
  descriptionText: string;
}

interface Term {
  term: string;
  postings: number;
  companies: Set<string>;
  categories: Map<string, number>;
  examples: { postingId: string; companySlug: string; text: string }[];
}

const stopWords = new Set(
  'the a an of and or to in with for on as is are be by at you your our we will have has this that from work working experience ability skills knowledge strong excellent required preferred years year must their they us can all other such including about more than within across which through team company role into using use good new its it these candidates qualifications responsibilities requirements minimum equivalent demonstrated candidate provide support without how not but also any who them while both every one etc e g i'.split(
    ' ',
  ),
);

const excludedRoles = new Set(['overview', 'benefits', 'compensation', 'application', 'legal']);

// Operator-only discovery. Unknown phrases are proposals, never automatically skills.
export class PublicVocabularyAudit {
  private readonly terms = new Map<string, Term>();
  private readonly frequencies = new Map<string, number>();
  private selected: Set<string> | undefined;
  private minimumPostings = 3;
  private recurringCandidates = 0;
  private reviewedPostings = 0;
  private readonly categories = new Map<string, number>();
  private readonly companies = new Set<string>();
  private readonly recognized = new Map<string, number>();
  private postings = 0;
  private empty = 0;
  private truncated = 0;
  private excludedBlocks = 0;
  private discoverySkippedBlocks = 0;

  add(posting: AuditPosting) {
    if (this.selected) {
      this.reviewedPostings++;
    } else {
      this.postings++;
      this.companies.add(posting.companySlug);
      this.categories.set(posting.category, (this.categories.get(posting.category) ?? 0) + 1);
    }

    if (!this.selected && !posting.descriptionText.trim()) {
      this.empty++;
    }

    const document = readJobDocument(posting.descriptionText);

    if (!this.selected && document.truncated) {
      this.truncated++;
    }

    const seen = new Set<string>();
    const known = new Set<string>();

    for (const block of document.blocks) {
      if (block.kind === 'heading' || excludedRoles.has(block.role)) {
        if (!this.selected) {
          this.excludedBlocks++;
        }

        continue;
      }

      const mentions = recognizeConcepts(block.text);
      const characters = block.text.split('');

      for (const mention of mentions) {
        known.add(mention.id);
        characters.fill('|', mention.position, mention.position + mention.length);
      }

      if (
        block.role !== 'qualifications' &&
        !/\b(?:experience|knowledge|proficien\w*|skills|design\w*|develop\w*|build\w*|built|implement\w*|manage\w*|maintain\w*|familiar\w*|expert\w*|collaborat\w*|using|with|including)\b/i.test(
          block.text,
        )
      ) {
        if (!this.selected) {
          this.discoverySkippedBlocks++;
        }

        continue;
      }

      // Preserve gaps: masking Python in "Python model" cannot invent a new phrase
      // by joining words on either side of that recognized claim.
      for (const fragment of characters.join('').split(/[|;!?\n]/)) {
        const tokens = [
          ...fragment.matchAll(/\.NET\b|[A-Za-z][A-Za-z0-9+#]*(?:[./-][A-Za-z0-9+#]+)*/g),
        ];

        for (let start = 0; start < tokens.length; start++) {
          for (let length = 1; length <= 3 && start + length <= tokens.length; length++) {
            const group = tokens.slice(start, start + length);

            if (group.some((token) => stopWords.has(token[0].toLowerCase()))) {
              continue;
            }

            if (
              group.some(
                (token, index) =>
                  index > 0 &&
                  !/^[\s-]{1,3}$/.test(
                    fragment.slice(
                      group[index - 1]!.index + group[index - 1]![0].length,
                      token.index,
                    ),
                  ),
              )
            ) {
              continue;
            }

            const term = group.map((token) => token[0].toLowerCase()).join(' ');

            if (seen.has(term)) {
              continue;
            }

            seen.add(term);

            if (!this.selected) {
              if (!this.frequencies.has(term) && this.frequencies.size >= 2_000_000) {
                throw new Error(
                  'Vocabulary audit candidate capacity exceeded; no complete report was produced.',
                );
              }

              this.frequencies.set(term, (this.frequencies.get(term) ?? 0) + 1);
              continue;
            }

            if (!this.selected.has(term)) {
              continue;
            }

            let entry = this.terms.get(term);

            if (!entry) {
              entry = {
                term,
                postings: 0,
                companies: new Set(),
                categories: new Map(),
                examples: [],
              };

              this.terms.set(term, entry);
            }

            entry.postings++;
            entry.companies.add(posting.companySlug);

            entry.categories.set(
              posting.category,
              (entry.categories.get(posting.category) ?? 0) + 1,
            );

            if (
              entry.examples.length < 3 &&
              !entry.examples.some((example) => example.companySlug === posting.companySlug)
            ) {
              const position = group[0]!.index;

              entry.examples.push({
                postingId: posting.id,
                companySlug: posting.companySlug,
                text: fragment
                  .slice(Math.max(0, position - 100), position + term.length + 140)
                  .trim(),
              });
            }
          }
        }
      }
    }

    if (!this.selected) {
      for (const id of known) {
        this.recognized.set(id, (this.recognized.get(id) ?? 0) + 1);
      }
    }
  }

  startReview(minimumPostings = 3, limit = 10_000) {
    if (
      this.selected ||
      !Number.isSafeInteger(minimumPostings) ||
      minimumPostings < 1 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 10_000
    ) {
      throw new Error('Vocabulary review requires one bounded discovery pass.');
    }

    const recurring = [...this.frequencies].filter(([, count]) => count >= minimumPostings);

    recurring.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    this.minimumPostings = minimumPostings;
    this.recurringCandidates = recurring.length;
    this.selected = new Set(recurring.slice(0, limit).map(([term]) => term));
  }

  report() {
    if (!this.selected || this.reviewedPostings !== this.postings) {
      throw new Error(
        'Vocabulary audit requires two complete passes over the same public snapshot.',
      );
    }

    const candidates = [...this.terms.values()].sort(
      (a, b) =>
        b.companies.size - a.companies.size ||
        b.postings - a.postings ||
        a.term.localeCompare(b.term),
    );

    return {
      registryVersion,
      postings: this.postings,
      companies: this.companies.size,
      categories: Object.fromEntries(this.categories),
      emptyDescriptions: this.empty,
      truncatedDescriptions: this.truncated,
      excludedBlocks: this.excludedBlocks,
      discoverySkippedBlocks: this.discoverySkippedBlocks,
      recognizedPostings: Object.fromEntries(this.recognized),
      uniqueUnknownTerms: this.frequencies.size,
      recurringCandidates: this.recurringCandidates,
      reportedCandidates: candidates.length,
      candidateListTruncated: this.recurringCandidates > candidates.length,
      minimumPostings: this.minimumPostings,
      candidates: candidates.map((entry) => ({
        ...entry,
        companies: [...entry.companies].sort(),
        categories: Object.fromEntries(entry.categories),
      })),
    };
  }
}
