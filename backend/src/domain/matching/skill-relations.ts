import { conceptsById, defaultFacet } from '../semantics/concepts.js';
import type { Interpretation, SkillFacet } from '../semantics/model.js';
import type { ResumeSignal } from '../resume/model.js';
import { supportedConcepts } from '../resume/vocabulary.js';

export const relationsVersion = 'relations-3';

export interface Relation {
  kind: 'transferable' | 'specialization' | 'possible-tool' | 'ecosystem';
  mode: 'partial' | 'suggestion';
  from: string;
  to: string;
  weight: number;
  reason: string;
}

export interface SkillMatch {
  decision: 'full' | 'partial' | 'suggested' | 'none';
  confidence: 'green' | 'yellow' | 'purple' | 'red';
  targetId: string;
  facet: SkillFacet;
  suggestion: { id: string; name: string; facet: SkillFacet; question: string } | null;
  credit: number;
  sourceId: string | null;
  sourceName: string | null;
  path: Relation[];
  reason: string;
}

// Directed, reviewed heuristics. Weights measure evidence credit, not probability.
const edges: [string, string, number, string][] = [
  ['typescript', 'javascript', 0.8, 'TypeScript builds on JavaScript'],
  ['javascript', 'typescript', 0.4, 'Related language; static typing is not established'],
  ['java', 'kotlin', 0.35, 'Related JVM ecosystem'],
  ['kotlin', 'java', 0.35, 'Related JVM ecosystem'],
  ['csharp', 'java', 0.3, 'Related object-oriented language; ecosystem differs'],
  ['java', 'csharp', 0.3, 'Related object-oriented language; ecosystem differs'],
  ['python', 'pandas', 0.2, 'Language knowledge does not establish a data library'],
  ['cpp', 'systems-programming', 0.8, 'Systems programming language'],
  ['cpp', 'memory-management', 0.55, 'Language exposes memory management'],
  ['cpp', 'low-level', 0.65, 'Language supports low-level programming'],
  ['cpp', 'multithreading', 0.3, 'Threading capability does not establish experience'],
  ['rust', 'systems-programming', 0.75, 'Systems programming language'],
  ['rust', 'memory-management', 0.5, 'Ownership and memory management concepts'],
  ['golang', 'concurrency', 0.4, 'Language has concurrency facilities'],
  ['systems-programming', 'cpp', 0.35, 'Systems experience does not establish a language'],
  ['low-level', 'operating-systems', 0.4, 'Related systems concepts'],
  ['operating-systems', 'memory-management', 0.55, 'Related operating-system concepts'],
  ['operating-systems', 'multithreading', 0.45, 'Related operating-system concepts'],
  ['operating-systems', 'systems-programming', 0.5, 'Related systems concepts'],
  ['memory-management', 'cpp', 0.25, 'Concept can be used in many languages'],
  ['memory-management', 'operating-systems', 0.4, 'Related systems concepts'],
  ['memory-management', 'low-level', 0.5, 'Related systems concepts'],
  [
    'multithreading',
    'operating-systems',
    0.35,
    'Threading does not establish broader OS knowledge',
  ],
  ['multithreading', 'concurrency', 0.8, 'Threading is one form of concurrency'],
  ['concurrency', 'multithreading', 0.5, 'Concurrency does not necessarily use threads'],
  ['linux', 'operating-systems', 0.65, 'Experience with an operating system'],
  ['data-structures', 'algorithms', 0.4, 'Related computer-science foundations'],
  ['algorithms', 'data-structures', 0.4, 'Related computer-science foundations'],
  ['redis', 'caching', 0.85, 'Common cache technology; usage still needs review'],
  ['redis', 'distributed-systems', 0.25, 'A distributed component alone is weak systems evidence'],
  ['redis', 'cloud-infrastructure', 0.25, 'Can run in a cloud or locally'],
  ['microservices', 'distributed-systems', 0.8, 'Services communicate across process boundaries'],
  ['microservices', 'cloud-applications', 0.55, 'Related application architecture'],
  [
    'cloud-applications',
    'cloud-infrastructure',
    0.5,
    'Application deployment is partial infrastructure evidence',
  ],
  [
    'cloud-infrastructure',
    'cloud-applications',
    0.4,
    'Infrastructure usage does not establish application design',
  ],
  ['cloud-applications', 'distributed-systems', 0.4, 'Cloud deployment alone is insufficient'],
  ['fault-tolerance', 'distributed-systems', 0.6, 'Related reliability concern'],
  ['high-availability', 'distributed-systems', 0.6, 'Related reliability concern'],
  ['fault-tolerance', 'high-availability', 0.55, 'Related but distinct reliability goals'],
  ['high-availability', 'fault-tolerance', 0.45, 'Availability does not prove failure recovery'],
  ['scalability', 'distributed-systems', 0.35, 'Scaling can also be local'],
  ['low-latency', 'distributed-systems', 0.2, 'Latency work can also be local'],
  [
    'performance-benchmarking',
    'distributed-systems',
    0.2,
    'Benchmarking is not architecture evidence',
  ],
  ['performance-benchmarking', 'performance-optimization', 0.6, 'Related performance practice'],
  ['performance-optimization', 'low-latency', 0.4, 'Optimization may target other metrics'],
  ['networking', 'distributed-systems', 0.4, 'Related communication concerns'],
  ['storage', 'distributed-systems', 0.35, 'Storage may be local'],
  ['kafka', 'distributed-systems', 0.65, 'Distributed messaging technology'],
  ['rabbitmq', 'distributed-systems', 0.45, 'Messaging component is partial evidence'],
  ['grpc', 'microservices', 0.4, 'RPC is used in several architectures'],
  ['dynamodb', 'aws', 0.65, 'AWS database service'],
  ['dynamodb', 'distributed-systems', 0.4, 'Using a distributed database is partial evidence'],
  ['kubernetes', 'cloud-infrastructure', 0.65, 'Orchestration may also be on-premises'],
  ['docker', 'kubernetes', 0.25, 'Containers do not establish orchestration skills'],
  ['kubernetes', 'docker', 0.4, 'Related container ecosystem'],
  ['terraform', 'cloud-infrastructure', 0.65, 'Infrastructure as code across providers'],
  ['observability', 'distributed-systems', 0.3, 'Monitoring can also concern local systems'],
  [
    'distributed-systems',
    'microservices',
    0.35,
    'Distributed architectures need not use microservices',
  ],
  [
    'distributed-systems',
    'fault-tolerance',
    0.35,
    'Related design concern; implementation not established',
  ],
  [
    'distributed-systems',
    'high-availability',
    0.35,
    'Related design concern; implementation not established',
  ],
  [
    'distributed-systems',
    'scalability',
    0.35,
    'Distributed design does not prove production scale',
  ],
  ['distributed-systems', 'networking', 0.25, 'Related communication concern'],
  ['distributed-systems', 'storage', 0.2, 'Related persistence concern'],
  [
    'distributed-systems',
    'performance-benchmarking',
    0.2,
    'Architecture does not prove benchmarking practice',
  ],
  ['distributed-systems', 'low-latency', 0.15, 'Architecture does not prove latency optimization'],
  ['postgresql', 'sql', 0.85, 'SQL database'],
  ['mysql', 'sql', 0.85, 'SQL database'],
  ['sql', 'postgresql', 0.35, 'SQL does not establish vendor-specific knowledge'],
  ['sql', 'mysql', 0.35, 'SQL does not establish vendor-specific knowledge'],
  ['postgresql', 'mysql', 0.5, 'Related relational database'],
  ['mysql', 'postgresql', 0.5, 'Related relational database'],
  ['mongodb', 'storage', 0.5, 'Database storage experience'],
  ['graphql', 'rest', 0.3, 'Related API design; different protocols'],
  ['rest', 'graphql', 0.25, 'Related API design; different protocols'],
  ['git', 'ci-cd', 0.2, 'Version control does not establish delivery automation'],
  ['ci-cd', 'git', 0.4, 'Related delivery workflow'],
  ['pytorch', 'machine-learning', 0.75, 'Machine-learning framework'],
  ['tensorflow', 'machine-learning', 0.75, 'Machine-learning framework'],
  ['pytorch', 'tensorflow', 0.35, 'Related frameworks with different APIs'],
  ['tensorflow', 'pytorch', 0.35, 'Related frameworks with different APIs'],
  ['pandas', 'python', 0.65, 'Python data library'],
  ['spark', 'distributed-systems', 0.5, 'Distributed processing framework'],
  ['dbt', 'sql', 0.6, 'SQL transformation tool'],
  ['statistics', 'ab-testing', 0.45, 'Related experimental foundations'],
  ['ab-testing', 'statistics', 0.45, 'Experiments provide partial statistical evidence'],
  ['excel', 'financial-modeling', 0.2, 'General tool does not establish modeling skills'],
  ['tableau', 'power-bi', 0.4, 'Related BI tools'],
  ['power-bi', 'tableau', 0.4, 'Related BI tools'],
  ['figma', 'product-discovery', 0.2, 'Design tool alone is weak discovery evidence'],
  ['user-research', 'product-discovery', 0.65, 'Research informs product discovery'],
  ['product-discovery', 'user-research', 0.4, 'Discovery can use different research methods'],
  ['roadmapping', 'product-strategy', 0.55, 'Related product planning'],
  ['product-strategy', 'roadmapping', 0.55, 'Related product planning'],
  ['scrum', 'delivery-ownership', 0.2, 'Process knowledge does not establish ownership'],
  ['salesforce', 'hubspot', 0.3, 'Related CRM tools'],
  ['hubspot', 'salesforce', 0.3, 'Related CRM tools'],
  ['account-management', 'negotiation', 0.4, 'Related account practice'],
  ['sales-prospecting', 'account-management', 0.25, 'Acquisition and account management differ'],
  ['recruiting', 'talent-acquisition', 0.8, 'Closely related hiring disciplines'],
  ['talent-acquisition', 'recruiting', 0.8, 'Closely related hiring disciplines'],
  ['payroll', 'hris', 0.3, 'Related HR tooling; platform not established'],
  ['hris', 'payroll', 0.25, 'HR platforms can serve other functions'],
  ['employee-relations', 'stakeholder-communication', 0.4, 'Related interpersonal practice'],
  [
    'cross-functional-leadership',
    'leadership',
    0.7,
    'Cross-team leadership does not prove line management',
  ],
  [
    'leadership',
    'cross-functional-leadership',
    0.3,
    'Team management does not establish cross-team leadership',
  ],
  ['mentoring', 'leadership', 0.35, 'Mentoring differs from managing a team'],
  [
    'cross-functional-leadership',
    'stakeholder-communication',
    0.65,
    'Cross-team initiatives involve stakeholders',
  ],
  [
    'delivery-ownership',
    'cross-functional-leadership',
    0.25,
    'Ownership may involve only one team',
  ],
];

for (const vendor of ['aws', 'azure', 'gcp']) {
  edges.push([vendor, 'cloud-infrastructure', 0.9, 'Cloud provider experience']);

  edges.push([
    'cloud-infrastructure',
    vendor,
    0.12,
    'Cloud experience does not identify a provider',
  ]);

  edges.push([vendor, 'distributed-systems', 0.35, 'Cloud usage is weak systems-design evidence']);
}

for (const framework of ['react', 'angular', 'vue', 'nodejs']) {
  edges.push([framework, 'javascript', 0.65, 'JavaScript ecosystem']);
  edges.push(['javascript', framework, 0.2, 'Language knowledge does not establish a framework']);
}

for (const language of ['html', 'css']) {
  edges.push([language, 'javascript', 0.15, 'Adjacent web skill, weak language evidence']);
}

// Specific activities provide partial broader evidence; tool discovery uses a separate policy.
const specialized: [string, string, number, string][] = [
  ['failover', 'fault-tolerance', 0.8, 'Failover is a failure recovery mechanism'],
  ['replication', 'distributed-systems', 0.55, 'Replication is one distributed design concern'],
  ['sharding', 'distributed-systems', 0.6, 'Partitioned storage is partial architecture evidence'],
  ['consensus', 'distributed-systems', 0.7, 'Agreement across nodes is a distributed concern'],
  ['circuit-breakers', 'fault-tolerance', 0.6, 'Failure isolation is one reliability mechanism'],
  ['aws-ec2', 'aws', 0.75, 'Specific AWS service usage'],
  ['aws-s3', 'aws', 0.65, 'Specific AWS storage service'],
  ['aws-lambda', 'aws', 0.7, 'Specific AWS compute service'],
  ['gcp-gke', 'gcp', 0.7, 'Google Cloud orchestration service'],
  ['gcp-bigquery', 'gcp', 0.65, 'Google Cloud data service'],
  ['azure-aks', 'azure', 0.7, 'Azure orchestration service'],
  [
    'profiling',
    'performance-optimization',
    0.55,
    'Measurement does not prove a resulting optimization',
  ],
  [
    'atomic-operations',
    'synchronization',
    0.65,
    'Atomic operations are one synchronization mechanism',
  ],
  [
    'cross-functional-delivery',
    'cross-functional-leadership',
    0.4,
    'Delivery across teams does not establish authority',
  ],
  [
    'technical-direction',
    'cross-functional-leadership',
    0.4,
    'Technical direction may concern only one team',
  ],
];

export const skillRelations: readonly Relation[] = [
  ...edges.map(([from, to, weight, reason]): Relation => ({
    from,
    to,
    weight,
    reason,
    kind: 'transferable',
    mode: 'partial',
  })),
  ...specialized.map(([from, to, weight, reason]): Relation => ({
    from,
    to,
    weight,
    reason,
    kind: 'specialization',
    mode: 'partial',
  })),
  ...['clang', 'llvm', 'cmake', 'gdb', 'lldb'].map((to): Relation => ({
    from: 'cpp',
    to,
    weight: 0,
    reason: 'C++ development may involve this tool; experience must be confirmed.',
    kind: 'possible-tool',
    mode: 'suggestion',
  })),
  {
    from: 'clang',
    to: 'llvm',
    weight: 0,
    reason: 'Related toolchain ecosystem; LLVM expertise is not established.',
    kind: 'ecosystem',
    mode: 'suggestion',
  },
];

const names = new Map(supportedConcepts.map((item) => [item.id, item.name]));
const adjacency = new Map<string, Relation[]>();

for (const edge of skillRelations) {
  adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge]);
}

type Claim = Pick<
  ResumeSignal,
  'id' | 'status' | 'facets' | 'deniedFacets' | 'uncertainFacets' | 'interpretation'
>;

const keyFor = (id: string, facet: SkillFacet) => `${id}@${facet}`;

function directCredit(signal: Claim) {
  if (['contextual', 'ambiguous'].includes(signal.interpretation ?? '')) {
    return 0;
  }

  return ['work_evidenced', 'user_confirmed'].includes(signal.status)
    ? 1
    : signal.status === 'mentioned'
      ? 0.6
      : 0;
}

function absent(id: string, facet: SkillFacet): SkillMatch {
  return {
    targetId: id,
    facet,
    decision: 'none',
    confidence: 'red',
    credit: 0,
    sourceId: null,
    sourceName: null,
    path: [],
    suggestion: null,
    reason: 'No matching evidence in the reviewed profile.',
  };
}

function suggestion(id: string, facet: SkillFacet, source: Claim, path: Relation[]): SkillMatch {
  const name = names.get(id) ?? id;

  const scope =
    facet === 'development' ? `developed ${name} internals (not just used it)` : `used ${name}`;

  return {
    ...absent(id, facet),
    decision: 'suggested',
    confidence: 'purple',
    sourceId: source.id,
    sourceName: names.get(source.id) ?? source.id,
    path,
    reason:
      'Possible unmentioned skill. This adds no evidence credit until you answer and review your profile.',
    suggestion: {
      id,
      name,
      facet,
      question: `Your ${names.get(source.id) ?? source.id} work may be related. Have you ${scope}?`,
    },
  };
}

export function projectSkills(signals: Claim[]): Map<string, SkillMatch> {
  const claims = new Map(signals.map((item) => [item.id, item]));
  const matches = new Map<string, SkillMatch>();

  for (const signal of signals) {
    const defaultScope = defaultFacet(signal.id);
    const supported = signal.facets ?? [defaultScope];

    for (const facet of conceptsById.get(signal.id)?.facets ?? ['general' as const]) {
      const denied =
        (signal.deniedFacets ?? []).includes(facet) ||
        (signal.status === 'negated' && !signal.deniedFacets?.length);

      const uncertain =
        (signal.uncertainFacets ?? []).includes(facet) ||
        (facet === 'usage' &&
          !supported.includes('usage') &&
          !supported.includes('development') &&
          (signal.uncertainFacets ?? []).includes('development'));

      const credit = denied
        ? 0
        : uncertain
          ? signal.status === 'mentioned' && signal.interpretation === 'explicit'
            ? 0.6
            : 0
          : supported.includes(facet) || (facet === 'usage' && supported.includes('development'))
            ? directCredit(signal)
            : facet === 'development' && supported.includes('usage')
              ? Math.min(0.4, directCredit(signal))
              : 0;

      const partial = !denied && (credit > 0 || uncertain || signal.status === 'learning');

      const result: SkillMatch = {
        ...absent(signal.id, facet),
        credit,
        decision: credit === 1 ? 'full' : partial ? 'partial' : 'none',
        confidence: credit === 1 ? 'green' : partial ? 'yellow' : 'red',
        sourceId: signal.id,
        sourceName: names.get(signal.id) ?? signal.id,
        reason: denied
          ? 'This skill or scope was explicitly denied.'
          : uncertain || ['contextual', 'ambiguous'].includes(signal.interpretation ?? '')
            ? 'Uncertain or contextual evidence; the skill is not established.'
            : facet === 'development' &&
                supported.includes('usage') &&
                !supported.includes('development')
              ? 'Tool usage is partial evidence; developing its internals is not established.'
              : credit === 1
                ? 'Direct work evidence, an equivalent activity, or user confirmation.'
                : signal.status === 'learning'
                  ? 'Learning; proficiency is not established.'
                  : 'Listed or related evidence; full coverage is not established.',
      };

      if (
        facet === 'development' &&
        supported.includes('usage') &&
        !supported.includes('development') &&
        !denied &&
        !uncertain
      ) {
        result.suggestion = {
          id: signal.id,
          name: names.get(signal.id) ?? signal.id,
          facet,
          question: `Have you developed ${names.get(signal.id) ?? signal.id} internals, beyond using the tool?`,
        };
      }

      matches.set(keyFor(signal.id, facet), result);

      if (facet === defaultScope) {
        matches.set(signal.id, result);
      }
    }
  }

  const originalCredits = new Map(
    signals.map((signal) => [signal.id, matches.get(signal.id)?.credit ?? 0]),
  );

  for (const signal of [...signals].sort((a, b) => a.id.localeCompare(b.id))) {
    const sourceCredit = originalCredits.get(signal.id) ?? 0;

    if (!sourceCredit || !names.has(signal.id)) {
      continue;
    }

    const visit = (node: string, path: Relation[], credit: number) => {
      if (path.length >= 2) {
        return;
      }

      for (const edge of adjacency.get(node) ?? []) {
        if (edge.to === signal.id || path.some((step) => step.from === edge.to)) {
          continue;
        }

        const target = claims.get(edge.to);

        if (edge.mode === 'suggestion') {
          // Only original full evidence can ask a one-edge, unanswered scope question.
          if (path.length || sourceCredit !== 1) {
            continue;
          }

          for (const facet of conceptsById.get(edge.to)?.facets ?? ['general' as const]) {
            const reviewed =
              target &&
              ((target.facets === undefined &&
                target.deniedFacets === undefined &&
                target.uncertainFacets === undefined) ||
                [
                  ...(target.facets ?? []),
                  ...(target.deniedFacets ?? []),
                  ...(target.uncertainFacets ?? []),
                ].includes(facet) ||
                (facet === 'usage' && (target.facets ?? []).includes('development')));

            if (reviewed) {
              continue;
            }

            const previous = matches.get(keyFor(edge.to, facet));

            if (previous && previous.decision !== 'none') {
              continue;
            }

            const result = suggestion(edge.to, facet, signal, [edge]);

            matches.set(keyFor(edge.to, facet), result);

            if (facet === defaultFacet(edge.to)) {
              matches.set(edge.to, result);
            }
          }

          continue;
        }

        if (
          target &&
          ((['negated', 'learning'].includes(target.status) && target.deniedFacets === undefined) ||
            (target.deniedFacets ?? []).includes(defaultFacet(edge.to)) ||
            (target.uncertainFacets ?? []).includes(defaultFacet(edge.to)))
        ) {
          continue;
        }

        const nextCredit = Math.min(0.8, credit * edge.weight);

        if (nextCredit < 0.025) {
          continue;
        }

        const nextPath = [...path, edge];
        const previous = matches.get(edge.to);

        if (nextCredit > (previous?.credit ?? 0)) {
          const facet = defaultFacet(edge.to);

          const result: SkillMatch = {
            ...absent(edge.to, facet),
            decision: 'partial',
            confidence: 'yellow',
            credit: nextCredit,
            sourceId: signal.id,
            sourceName: names.get(signal.id) ?? signal.id,
            path: nextPath,
            reason: 'Related evidence; confirm this skill before treating the requirement as met.',
          };

          matches.set(edge.to, result);
          matches.set(keyFor(edge.to, facet), result);
        }

        visit(edge.to, nextPath, nextCredit);
      }
    };

    visit(signal.id, [], sourceCredit);
  }

  return matches;
}

export function skillMatch(
  matches: Map<string, SkillMatch>,
  id: string,
  facet = defaultFacet(id),
  interpretation: Interpretation = 'explicit',
): SkillMatch {
  const match =
    matches.get(keyFor(id, facet)) ??
    (facet === defaultFacet(id) ? matches.get(id) : undefined) ??
    absent(id, facet);

  return match.credit === 1 && ['ambiguous', 'contextual'].includes(interpretation)
    ? {
        ...match,
        credit: 0.6,
        decision: 'partial',
        confidence: 'yellow',
        reason: 'The job statement has an uncertain scope. Review the original clause.',
      }
    : match;
}
