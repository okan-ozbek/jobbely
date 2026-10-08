import type { Interpretation, SkillFacet } from './model.js';
import { defaultFacet } from './concepts.js';

export const clauseVersion = 'clauses-4';

export function normalizeText(text: string) {
  // These replacements preserve UTF-16 offsets into the original document.
  return text
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/[’‘]/g, "'")
    .replace(/\u00a0/g, ' ');
}

export function assertionAt(
  text: string,
  position: number,
): 'positive' | 'negated' | 'learning' | 'contextual' | 'ambiguous' {
  const normalized = normalizeText(text);
  const before = normalized.slice(0, position);
  const prefix = before.split(/(?:[!?;\n]|\.(?=\s|$)|\bbut\b|\bhowever\b)/i).at(-1) ?? '';

  const clause =
    normalized.slice(Math.max(0, before.length - prefix.length)).split(/[!?;\n]|\.(?=\s|$)/)[0] ??
    '';

  // Scope extends through coordinated lists, but stops at contrast/statement boundaries.
  if (
    /\b(?:no(?: professional)? experience (?:with|in)|not (?:experienced|proficient) (?:with|in)|never (?:used|worked with|built|implemented|designed|developed|wrote|documented|collaborated|partnered|provisioned)|do not know|don't know|did not|didn't|not responsible for|without experience (?:in|with))\b[^.!?;]{0,160}$/i.test(
      prefix,
    ) ||
    /\bnever\s*$/i.test(prefix)
  ) {
    return 'negated';
  }

  if (
    /\b(?:learning|studying|beginner (?:in|with)|exploring|hope to learn|want to learn|planning to learn)\b[^.!?;]{0,100}$/i.test(
      prefix,
    )
  ) {
    return 'learning';
  }

  if (
    /\b(?:observed|watched|assisted|would like to|plan to|planned to|hope to|hoping to|helped another team|participated in|exposure to|familiarity with)\b/i.test(
      clause,
    )
  ) {
    return 'ambiguous';
  }

  if (
    /\b(?:(?:our|the) (?:company|platform|product|team) (?:uses?|runs?|supports?|provides?|implements?|keeps?)|we use|another team (?:uses?|implemented|built))\b/i.test(
      clause,
    )
  ) {
    return 'contextual';
  }

  return 'positive';
}

export function facetInText(id: string, text: string, position = 0): SkillFacet {
  if (!['llvm', 'clang', 'gcc', 'msvc', 'mlir'].includes(id)) {
    return defaultFacet(id);
  }

  const source = normalizeText(text);

  const prefix =
    source
      .slice(0, position)
      .split(/(?:[!?;\n]|\.(?=\s|$)|\bbut\b)/)
      .at(-1) ?? '';

  const normalized =
    source.slice(position - prefix.length).split(/(?:[!?;\n]|\.(?=\s|$)|\bbut\b)/)[0] ?? '';

  if (
    /\b(?:compiler development|compiler construction|compiler internals|compiler frontend|compiler front-end|optimization passes|optimisation passes|LLVM passes|Clang frontend|Clang front-end|LLVM development|Clang development|MLIR dialects)\b/i.test(
      normalized,
    )
  ) {
    return 'development';
  }

  return 'usage';
}

export function interpretationFor(
  text: string,
  position: number,
  fallback: Interpretation,
): Interpretation {
  const assertion = assertionAt(text, position);

  return assertion === 'contextual'
    ? 'contextual'
    : assertion === 'ambiguous'
      ? 'ambiguous'
      : fallback;
}

export interface PhraseRule {
  id: string;
  pattern: RegExp;
  concepts: { id: string; facet?: SkillFacet }[];
}

// Rules encode observable activities, not employer reputation or generic soft-skill adjectives.
export const phraseRules: readonly PhraseRule[] = [
  {
    id: 'stakeholder-collaboration',
    pattern:
      /\b(?:work(?:ing|ed)?|collaborat(?:e|ed|ing)|partner(?:ed|ing)?|coordinat(?:e|ed|ing)|communicat(?:e|ed|ing))\b[^.!?;\n]{0,70}\b(?:with|across)\s+(?:(?:engineers?|developers?|teams?|colleagues)\s+and\s+)?(?:(?:internal|external|technical|business|senior|key|multiple|all|and)\s+){0,4}stakeholders\b/gi,
    concepts: [{ id: 'stakeholder-communication' }],
  },
  {
    id: 'clear-api-design',
    pattern:
      /\b(?:design(?:ed|ing)?|build(?:ing)?|built|implement(?:ed|ing)?|provid(?:e|ed|ing)|through)\b[^.!?;\n]{0,60}\bclear APIs?\b/gi,
    concepts: [{ id: 'api-design' }],
  },
  {
    id: 'datastore-connectors',
    pattern: /\bconnectors?\b(?=[^.!?;\n]{0,150}\bdata\s?stores?\b)/gi,
    concepts: [{ id: 'data-integration' }],
  },
  {
    id: 'cross-team-delivery-scope',
    pattern: /\b(?:led|owned|delivered) (?:architecture and )?cross[ -]team delivery\b/gi,
    concepts: [{ id: 'cross-functional-delivery' }, { id: 'delivery-ownership' }],
  },
  {
    id: 'cache-latency-outcome',
    pattern: /\b(?:reduced|cut|lowered) (?:hot[ -]path |request |response )?latency(?: from)?\b/gi,
    concepts: [{ id: 'low-latency' }, { id: 'performance-optimization' }],
  },
  {
    id: 'throughput-benchmarking',
    pattern: /\bthroughput\/latency benchmarks?\b/gi,
    concepts: [{ id: 'performance-benchmarking' }, { id: 'throughput' }],
  },
  {
    id: 'inference-training',
    pattern: /\binference and training technologies\b/gi,
    concepts: [{ id: 'ml-inference' }, { id: 'model-training' }],
  },
  {
    id: 'training-inference',
    pattern: /\btraining and inference technologies\b/gi,
    concepts: [{ id: 'model-training' }, { id: 'ml-inference' }],
  },
  {
    id: 'failure-recovery',
    pattern:
      /\b(?:keep|kept|keeping) (?:our |the )?services? running (?:when|if|despite) (?:individual |some )?(?:machines?|nodes?|servers?) fail(?:ed|s)?\b/gi,
    concepts: [{ id: 'fault-tolerance' }, { id: 'high-availability' }],
  },
  {
    id: 'implemented-failover',
    pattern:
      /\b(?:implement(?:ed|ing)?|design(?:ed|ing)?|built|build(?:ing)?|automat(?:ed|ing)) (?:automatic |automated )?failover(?: between replicas)?\b/gi,
    concepts: [{ id: 'failover' }, { id: 'fault-tolerance' }],
  },
  {
    id: 'latency-outcome',
    pattern:
      /\b(?:cut|reduc(?:e|ed|ing)|lower(?:ed|ing)?) (?:p(?:95|99) |request |response )?(?:request |response )?(?:time|latency)(?: by \d+(?:\.\d+)?\s*%)?\b/gi,
    concepts: [{ id: 'low-latency' }, { id: 'performance-optimization' }],
  },
  {
    id: 'profiling-locks',
    pattern: /\bprofil(?:e|ed|ing) (?:CPU bottlenecks|lock contention|CPU usage)\b/gi,
    concepts: [{ id: 'profiling' }, { id: 'performance-optimization' }],
  },
  {
    id: 'cross-team-delivery',
    pattern:
      /\bdeliver(?:ed|ing)? (?:changes|projects|initiatives) (?:spanning|across) (?:engineering,? product and operations|multiple teams|several teams)\b/gi,
    concepts: [{ id: 'cross-functional-delivery' }],
  },
  {
    id: 'cross-team-ownership',
    pattern:
      /\b(?:owned|own|led|lead|leading) (?:technical )?initiatives across (?:multiple )?teams\b/gi,
    concepts: [{ id: 'cross-functional-leadership' }],
  },
  {
    id: 'technical-direction',
    pattern: /\b(?:set|setting|established|establishing) (?:the )?technical direction\b/gi,
    concepts: [{ id: 'technical-direction' }],
  },
  {
    id: 'team-management',
    pattern:
      /\b(?:managed|managing|led|leading|supervised|supervising) (?:a |the |\d+ )?(?:teams?|group of (?:junior and senior )?engineers|engineers)\b/gi,
    concepts: [{ id: 'leadership' }],
  },
  {
    id: 'mentored-people',
    pattern:
      /\bmentor(?:ed|ing)? (?:\d+ |junior |senior )?(?:engineers?|developers?|colleagues?|team members?)\b/gi,
    concepts: [{ id: 'mentoring' }],
  },
  {
    id: 'cross-team-leadership',
    pattern: /\b(?:led|lead|leading|managed) cross[ -]functional initiatives\b/gi,
    concepts: [{ id: 'cross-functional-leadership' }],
  },
  {
    id: 'compiler-passes',
    pattern:
      /\b(?:wrote|written|author(?:ed|ing)?|implement(?:ed|ing)?|develop(?:ed|ing)?) (?:custom )?LLVM (?:optimization |optimisation )?passes\b/gi,
    concepts: [{ id: 'llvm', facet: 'development' }, { id: 'compiler-optimization' }],
  },
  {
    id: 'compiler-frontend',
    pattern:
      /\b(?:develop(?:ed|ing)?|extend(?:ed|ing)?|maintain(?:ed|ing)?) (?:the )?Clang front[ -]?end\b/gi,
    concepts: [{ id: 'clang', facet: 'development' }, { id: 'compiler-frontends' }],
  },
  {
    id: 'replica-recovery',
    pattern:
      /\b(?:recover(?:ed|ing)?|restor(?:e|ed|ing)) services? after (?:node|server|machine) failures?\b/gi,
    concepts: [{ id: 'fault-tolerance' }],
  },
  {
    id: 'parallel-requests',
    pattern:
      /\b(?:process(?:ed|ing)?|handle(?:d|s)?|handling) (?:multiple |many )?requests (?:concurrently|in parallel)\b/gi,
    concepts: [{ id: 'concurrency' }],
  },
  {
    id: 'query-plan-work',
    pattern: /\b(?:optimi[sz](?:e|ed|ing)|tun(?:e|ed|ing)) (?:SQL )?quer(?:y plans|ies)\b/gi,
    concepts: [{ id: 'query-optimization' }],
  },
  {
    id: 'rollout-work',
    pattern:
      /\b(?:roll(?:ed|ing)? out|deploy(?:ed|ing)?) (?:changes|releases) (?:gradually|to a subset of (?:users|servers))\b/gi,
    concepts: [{ id: 'canary-deployments' }],
  },
];
