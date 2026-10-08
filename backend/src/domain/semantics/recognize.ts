import { concepts, conceptsById, defaultFacet } from './concepts.js';
import { facetInText, interpretationFor, normalizeText, phraseRules } from './clauses.js';
import type { ConceptMention } from './model.js';
import { corpusAliasAllowed } from './corpus-guards.js';

const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const patterns = concepts.map((concept) => ({
  concept,
  aliases: concept.aliases.map((alias) => normalizeText(alias).toLowerCase()),
  pattern: new RegExp(
    `(^|[^\\p{L}\\p{N}_])(${concept.aliases.map((alias) => escapePattern(normalizeText(alias))).join('|')})(?=$|[^\\p{L}\\p{N}_])`,
    'giu',
  ),
}));

function allowed(id: string, alias: string, text: string, technicalList: boolean) {
  if (
    id === 'databricks' &&
    !technicalList &&
    !/\b(?:using|used|with|platform|pipelines?|Spark|Delta|clusters?|notebooks?|SQL|proficiency|knowledge)\b/i.test(
      text,
    )
  ) {
    return false;
  }

  if (
    id === 'developer-experience' &&
    !technicalList &&
    !/\b(?:tooling|tools|workflows?|infrastructure|platform|services?|improv(?:e|ed|ing)|DX)\b/i.test(
      text,
    )
  ) {
    return false;
  }

  if (
    id === 'monitoring' &&
    /^monitoring$/i.test(alias) &&
    !technicalList &&
    !/\b(?:services?|systems?|infrastructure|software|application|platform|observability|metrics|logs|Prometheus|Grafana)\b/i.test(
      text,
    )
  ) {
    return false;
  }

  if (
    id === 'excel' &&
    !technicalList &&
    !/\b(?:Microsoft Excel|spreadsheets?|workbooks?|pivot tables?|VLOOKUP|Excel formulas?|experience with Excel|knowledge of Excel|proficiency in Excel|proficient in Excel|Excel (?:required|preferred|skills))\b/i.test(
      text,
    ) &&
    !/^\s*Excel[.!]?\s*$/i.test(text)
  ) {
    return false;
  }

  if (
    id === 'c' &&
    /^C$/i.test(alias) &&
    !technicalList &&
    !/\b(?:embedded C|C language|C programming|programming (?:in|with) C)\b|C\+\+|\b(?:Java|Python|Rust)\b/.test(
      text,
    )
  ) {
    return false;
  }

  if (
    id === 'low-level' &&
    !/\b(?:programming|systems?|memory|threading|software|engineering)\b|C\+\+/i.test(text)
  ) {
    return false;
  }

  if (
    ['golang', 'react', 'rust', 'spark'].includes(id) &&
    /^(?:Go|React|Rust|Spark)$/i.test(alias)
  ) {
    return (
      technicalList ||
      /\b(?:built|build|develop|developed|implemented|architected|workflows|adoption|using|uses?|used|programming|language|framework|backend|frontend|services?|proficien(?:t|cy)|knowledge|experience|skills|studying|learning|exploring)\b/i.test(
        text,
      ) ||
      /^\s*(?:Go|React|Rust|Spark)(?:\s+(?:required|preferred))?\.?\s*$/i.test(text) ||
      /\b(?:Java|Python|TypeScript|SQL|Docker|Kubernetes)\b/i.test(text)
    );
  }

  return true;
}

export function recognizeConcepts(text: string, technicalList = false): ConceptMention[] {
  const normalized = normalizeText(text);
  const mentions: ConceptMention[] = [];
  const lowerText = normalized.toLowerCase();

  for (const { concept, aliases, pattern } of patterns) {
    if (!aliases.some((alias) => lowerText.includes(alias))) {
      continue;
    }

    for (const match of normalized.matchAll(pattern)) {
      const position = match.index + match[1]!.length;

      if (
        !allowed(concept.id, match[2]!, normalized, technicalList) ||
        !corpusAliasAllowed(concept.id, match[2]!, normalized, position, technicalList)
      ) {
        continue;
      }

      mentions.push({
        id: concept.id,
        name: concept.name,
        position,
        length: match[2]!.length,
        facet: facetInText(concept.id, text, position),
        interpretation: interpretationFor(text, position, 'explicit'),
        rule: `alias:${concept.id}`,
      });

      if (mentions.length >= 2_000) {
        return mentions.sort((a, b) => a.position - b.position || b.length - a.length);
      }
    }
  }

  // Vendor scope qualifies abbreviated services; the vendor alone implies none.
  const scopedServices: [string, string, RegExp][] = [
    ['aws-s3', 'Amazon S3', /\bS3\b/g],
    ['aws-ecs', 'Amazon ECS', /\bECS\b/g],
    ['aws-elasticache', 'Amazon ElastiCache', /\bElastiCache\b/g],
  ];

  for (const vendor of normalized.matchAll(/\b(?:AWS|Amazon Web Services)\s*\([^)]{1,180}\)/gi)) {
    for (const [id, name, pattern] of scopedServices) {
      if (!conceptsById.has(id)) {
        continue;
      }

      for (const service of vendor[0].matchAll(pattern)) {
        if (
          !mentions.some((item) => item.id === id && item.position === vendor.index + service.index)
        ) {
          mentions.push({
            id,
            name,
            position: vendor.index + service.index,
            length: service[0].length,
            facet: defaultFacet(id),
            interpretation: interpretationFor(text, vendor.index + service.index, 'explicit'),
            rule: `alias:${id}:vendor-scope`,
          });
        }
      }
    }
  }

  for (const rule of phraseRules) {
    for (const match of normalized.matchAll(rule.pattern)) {
      for (const output of rule.concepts) {
        const concept = conceptsById.get(output.id)!;

        mentions.push({
          id: output.id,
          name: concept.name,
          position: match.index,
          length: match[0].length,
          facet: output.facet ?? facetInText(output.id, text, match.index),
          interpretation: interpretationFor(text, match.index, 'interpreted'),
          rule: `clause:${rule.id}`,
        });
      }

      if (mentions.length >= 2_000) {
        break;
      }
    }

    if (mentions.length >= 2_000) {
      break;
    }
  }

  return mentions
    .filter(
      (item) =>
        !item.rule.startsWith('alias:') ||
        !mentions.some(
          (other) =>
            other.rule.startsWith('alias:') &&
            other.length > item.length &&
            other.position <= item.position &&
            other.position + other.length >= item.position + item.length,
        ),
    )
    .sort((a, b) => a.position - b.position || b.length - a.length || a.id.localeCompare(b.id));
}

export function conceptsInText(text: string) {
  const seen = new Set<string>();

  return recognizeConcepts(text).filter((mention) => {
    const key = `${mention.id}:${mention.facet}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
}
