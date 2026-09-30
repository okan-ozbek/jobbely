import type { Classification, ExtractedPosting } from './model.js';

export interface ClassificationStrategy {
  classify(posting: ExtractedPosting, companySlug: string): Classification | null;
}
const version = '1';
const decision = (
  category: string,
  method: Classification['method'],
  rule: string,
  evidence: string,
): Classification => ({ category, method, rule, evidence, version });

const labelMap: Record<string, string> = {
  engineering: 'engineering',
  'software engineering': 'engineering',
  'software development': 'engineering',
  'product engineering': 'engineering',
  'core tech engineering': 'engineering',
  'data science': 'data-ai',
  'data engineering': 'data-ai',
  'machine learning': 'data-ai',
  'quantitative research': 'quant-trading',
  trading: 'quant-trading',
  research: 'research',
  'product management': 'product',
  product: 'product',
  'product design': 'design',
  design: 'design',
  sales: 'sales',
  'business development': 'sales',
  marketing: 'marketing',
  communications: 'marketing',
  'customer success': 'customer-success',
  'customer support': 'customer-success',
  support: 'customer-success',
  people: 'people',
  'human resources': 'people',
  recruiting: 'people',
  recruitment: 'people',
  accounting: 'finance',
  finance: 'finance',
  'finance & accounting': 'finance',
  legal: 'legal',
  compliance: 'legal',
  policy: 'legal',
  security: 'security-it',
  'security engineering': 'security-it',
  'it & corporate security': 'security-it',
  administration: 'operations',
  manufacturing: 'manufacturing',
  retail: 'retail',
};

export class LabelMappingStrategy implements ClassificationStrategy {
  constructor(private readonly companyMappings: Record<string, Record<string, string>> = {}) {}
  classify(posting: ExtractedPosting, companySlug: string): Classification | null {
    const labels = posting.departments.map((label) => label.trim().toLowerCase());
    const companyMap = this.companyMappings[companySlug];
    for (const label of labels.toReversed()) {
      const category = companyMap?.[label];
      if (category) {
        return decision(category, 'source_mapping', `company:${companySlug}:${label}`, label);
      }
    }
    const matches = labels
      .map((label) => ({ label, category: labelMap[label] }))
      .filter((match) => match.category);
    const unique = new Set(matches.map((match) => match.category));
    // Distinct department assignments have no universal hierarchy. Defer conflicting labels to title rules.
    if (unique.size !== 1) {
      return null;
    }
    const match = matches.at(-1);
    return match?.category
      ? decision(match.category, 'source_mapping', `label:${match.label}`, match.label)
      : null;
  }
}

const titleRules: [string, RegExp][] = [
  [
    'sales',
    /\b(sales engineer|solutions engineer|account executive|sales development|business development)\b/i,
  ],
  ['people', /\b(recruiter|recruiting|human resources|people partner|hris)\b/i],
  [
    'quant-trading',
    /\b(quantitative researcher|quant researcher|quantitative trader|quant developer|trader)\b/i,
  ],
  ['design', /\b(product designer|ux designer|visual designer|graphic designer)\b/i],
  ['product', /\bproduct manager\b/i],
  ['customer-success', /\b(customer success|technical support|support engineer)\b/i],
  ['security-it', /\b(security engineer|security analyst|it support)\b/i],
  ['data-ai', /\b(data scientist|data engineer|machine learning engineer)\b/i],
  ['research', /\b(research scientist|research engineer)\b/i],
  ['finance', /\b(accountant|financial analyst|finance manager)\b/i],
  ['legal', /\b(legal counsel|compliance officer|attorney)\b/i],
  ['marketing', /\b(marketing manager|communications manager|copywriter)\b/i],
  [
    'engineering',
    /\b(software engineer|software developer|backend engineer|frontend engineer|full.stack engineer|site reliability engineer|hardware engineer)\b/i,
  ],
];
export class TitleRuleStrategy implements ClassificationStrategy {
  classify(posting: ExtractedPosting): Classification | null {
    const matches = titleRules.filter(([, pattern]) => pattern.test(posting.title));
    // A title that explicitly contains two different functions stays ambiguous.
    if (new Set(matches.map(([category]) => category)).size !== 1) {
      return null;
    }
    const match = matches[0];
    return match ? decision(match[0], 'title_rule', `title:${match[0]}`, posting.title) : null;
  }
}
export function classify(
  posting: ExtractedPosting,
  companySlug: string,
  strategies: readonly ClassificationStrategy[],
): Classification {
  for (const strategy of strategies) {
    const result = strategy.classify(posting, companySlug);
    if (result) {
      return result;
    }
  }
  return decision(
    'unclassified',
    'unclassified',
    'no-unambiguous-match',
    posting.departments.join(' / ') || posting.title,
  );
}
