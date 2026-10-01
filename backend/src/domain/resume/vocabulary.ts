import type { ResumeLine, ResumeSignal } from './model.js';

export const vocabularyVersion = 'functions-5';

// Deliberately reviewed starter coverage, not a claim of universal skill recognition.
const definitions: [string, string, string[]][] = [
  ['typescript', 'TypeScript', ['TypeScript']],
  ['javascript', 'JavaScript', ['JavaScript', 'ECMAScript']],
  ['java', 'Java', ['Java']],
  ['kotlin', 'Kotlin', ['Kotlin']],
  ['python', 'Python', ['Python']],
  ['golang', 'Go', ['Golang', 'Go']],
  ['rust', 'Rust', ['Rust']],
  ['csharp', 'C#', ['C#', 'C Sharp']],
  ['cpp', 'C++', ['C++']],
  ['react', 'React', ['React.js', 'ReactJS', 'React']],
  ['angular', 'Angular', ['Angular']],
  ['vue', 'Vue', ['Vue.js', 'VueJS']],
  ['nodejs', 'Node.js', ['Node.js', 'NodeJS']],
  ['html', 'HTML', ['HTML', 'HTML5']],
  ['css', 'CSS', ['CSS', 'CSS3']],
  ['sql', 'SQL', ['SQL']],
  ['postgresql', 'PostgreSQL', ['PostgreSQL', 'Postgres']],
  ['mysql', 'MySQL', ['MySQL']],
  ['mongodb', 'MongoDB', ['MongoDB']],
  ['redis', 'Redis', ['Redis']],
  ['graphql', 'GraphQL', ['GraphQL']],
  ['rest', 'REST APIs', ['REST API', 'REST APIs', 'RESTful']],
  ['git', 'Git', ['Git']],
  ['docker', 'Docker', ['Docker']],
  ['kubernetes', 'Kubernetes', ['Kubernetes', 'K8s']],
  ['aws', 'AWS', ['AWS', 'Amazon Web Services']],
  ['azure', 'Azure', ['Azure']],
  ['gcp', 'Google Cloud', ['Google Cloud', 'GCP']],
  ['terraform', 'Terraform', ['Terraform']],
  ['linux', 'Linux', ['Linux']],
  ['ci-cd', 'CI/CD', ['CI/CD', 'continuous integration']],
  ['machine-learning', 'Machine learning', ['machine learning']],
  ['pytorch', 'PyTorch', ['PyTorch']],
  ['tensorflow', 'TensorFlow', ['TensorFlow']],
  ['pandas', 'pandas', ['pandas']],
  ['spark', 'Apache Spark', ['Apache Spark', 'PySpark', 'Spark']],
  ['excel', 'Excel', ['Excel']],
  ['tableau', 'Tableau', ['Tableau']],
  ['power-bi', 'Power BI', ['Power BI']],
  ['figma', 'Figma', ['Figma']],
  ['user-research', 'User research', ['user research']],
  ['product-discovery', 'Product discovery', ['product discovery']],
  ['roadmapping', 'Product roadmapping', ['roadmapping', 'product roadmap']],
  ['ab-testing', 'A/B testing', ['A/B testing', 'A/B tests']],
  ['scrum', 'Scrum', ['Scrum']],
  ['salesforce', 'Salesforce', ['Salesforce']],
  ['hubspot', 'HubSpot', ['HubSpot']],
  ['account-management', 'Account management', ['account management']],
  ['recruiting', 'Recruiting', ['recruiting', 'recruitment']],
  ['talent-acquisition', 'Talent acquisition', ['talent acquisition']],
  ['payroll', 'Payroll', ['payroll']],
  ['financial-modeling', 'Financial modeling', ['financial modeling', 'financial modelling']],
  ['dbt', 'dbt', ['dbt']],
  ['statistics', 'Statistics', ['statistics', 'statistical analysis']],
  ['sales-prospecting', 'Sales prospecting', ['prospecting', 'lead generation']],
  ['negotiation', 'Negotiation', ['negotiation', 'negotiating']],
  ['hris', 'HRIS', ['HRIS']],
  ['employee-relations', 'Employee relations', ['employee relations']],
  ['product-strategy', 'Product strategy', ['product strategy']],
  [
    'distributed-systems',
    'Distributed systems',
    ['distributed systems', 'distributed services', 'distributed computing'],
  ],
  ['microservices', 'Microservices', ['microservices', 'microservice']],
  ['cloud-infrastructure', 'Cloud infrastructure', ['cloud infrastructure', 'cloud computing']],
  [
    'cloud-applications',
    'Cloud applications',
    ['cloud applications', 'cloud-based applications', 'cloud-native applications'],
  ],
  [
    'operating-systems',
    'Operating systems',
    ['operating systems', 'operating system', 'OS concepts'],
  ],
  ['low-level', 'Low-level programming', ['low-level', 'low level programming', 'low level']],
  ['memory-management', 'Memory management', ['memory management']],
  ['multithreading', 'Multithreading', ['multithreading', 'multi-threading', 'multi threading']],
  ['concurrency', 'Concurrency', ['concurrency', 'concurrent programming']],
  ['systems-programming', 'Systems programming', ['systems programming']],
  ['networking', 'Networking', ['computer networking', 'networking']],
  ['storage', 'Storage systems', ['storage systems', 'distributed storage']],
  ['caching', 'Caching', ['caching', 'distributed cache']],
  [
    'fault-tolerance',
    'Fault tolerance',
    ['fault-tolerance', 'fault tolerance', 'fault-tolerant', 'fault tolerant'],
  ],
  ['high-availability', 'High availability', ['high availability', 'high-availability']],
  [
    'performance-optimization',
    'Performance optimization',
    ['performance optimization', 'performance optimisation'],
  ],
  [
    'performance-benchmarking',
    'Performance benchmarking',
    ['performance benchmarking', 'performance benchmarks'],
  ],
  ['low-latency', 'Low latency', ['low latency', 'low-latency']],
  [
    'scalability',
    'Scalability',
    ['scalability', 'scalable', 'large scale systems', 'large-scale systems'],
  ],
  ['data-structures', 'Data structures', ['data structures']],
  ['algorithms', 'Algorithms', ['algorithms']],
  ['kafka', 'Apache Kafka', ['Apache Kafka', 'Kafka']],
  ['rabbitmq', 'RabbitMQ', ['RabbitMQ']],
  ['dynamodb', 'DynamoDB', ['DynamoDB']],
  ['grpc', 'gRPC', ['gRPC']],
  ['observability', 'Observability', ['observability']],
];

const competencyDefinitions: [string, string, string[]][] = [
  [
    'leadership',
    'Team leadership',
    ['team leadership', 'people management', 'leading a group of', 'leading a team'],
  ],
  ['mentoring', 'Mentoring', ['mentoring', 'mentorship']],
  [
    'stakeholder-communication',
    'Stakeholder communication',
    ['stakeholder communication', 'stakeholder management'],
  ],
  ['delivery-ownership', 'Delivery ownership', ['delivery ownership', 'project ownership']],
  [
    'cross-functional-leadership',
    'Cross-functional leadership',
    [
      'cross-functional leadership',
      'cross functional leadership',
      'lead cross-functional initiatives',
      'leading cross-functional initiatives',
      'led cross-functional initiatives',
    ],
  ],
];

export const supportedConcepts = [...definitions, ...competencyDefinitions].map(([id, name]) => ({
  id,
  name,
}));

export const supportedSkills = definitions.map(([id, name]) => ({ id, name }));

export function resolveSkill(name: string) {
  const key = name.trim().toLowerCase();

  const definition = [...definitions, ...competencyDefinitions].find(([, label, aliases]) =>
    [label, ...aliases].some((alias) => alias.toLowerCase() === key),
  );

  return definition ? { id: definition[0], name: definition[1] } : null;
}

function escapePattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const patterns = definitions.map(([id, name, aliases]) => ({
  id,
  name,
  pattern: new RegExp(
    `(^|[^\\p{L}\\p{N}])(${aliases.map(escapePattern).join('|')})(?=$|[^\\p{L}\\p{N}])`,
    'iu',
  ),
}));

const requirementPatterns = [
  ...patterns,
  ...competencyDefinitions.map(([id, name, aliases]) => ({
    id,
    name,
    pattern: new RegExp(
      `(^|[^\\p{L}\\p{N}])(${aliases.map(escapePattern).join('|')})(?=$|[^\\p{L}\\p{N}])`,
      'iu',
    ),
  })),
];

export function skillsInText(text: string) {
  return requirementPatterns
    .flatMap((skill) => {
      const match = skill.pattern.exec(text);

      if (
        skill.id === 'low-level' &&
        match &&
        !/\b(?:programming|systems?|memory|threading|software|engineering|c\+\+)\b/i.test(text)
      ) {
        return [];
      }

      if (
        ['golang', 'react', 'rust', 'spark'].includes(skill.id) &&
        match &&
        /^(?:Go|React|Rust|Spark)$/i.test(match[2]!) &&
        !/\b(?:built|developed|implemented|using|uses?|used|programming|language|framework|backend|frontend|services?|proficien(?:t|cy)|knowledge|experience)\b/i.test(
          text,
        ) &&
        !/^\s*(?:Go|React|Rust|Spark)(?:\s+(?:required|preferred))?\.?\s*$/i.test(text) &&
        !patterns.some(
          (other) =>
            !['golang', 'react', 'rust', 'spark'].includes(other.id) && other.pattern.test(text),
        )
      ) {
        return [];
      }

      return match
        ? [
            {
              id: skill.id,
              name: skill.name,
              position: match.index + (match[1]?.length ?? 0),
              length: match[2]!.length,
            },
          ]
        : [];
    })
    .sort((a, b) => a.position - b.position);
}

// Preserve every occurrence for description annotations, using the same recognition rules.
export function skillMentions(text: string) {
  const mentions: ReturnType<typeof skillsInText> = [];
  let offset = 0;

  for (const line of text.slice(0, 200_000).split('\n')) {
    for (const concept of skillsInText(line)) {
      const definition = requirementPatterns.find((item) => item.id === concept.id)!;
      const pattern = new RegExp(definition.pattern.source, 'giu');

      for (const match of line.matchAll(pattern)) {
        mentions.push({
          ...concept,
          position: offset + match.index + match[1]!.length,
          length: match[2]!.length,
        });

        if (mentions.length >= 2_000) {
          break;
        }
      }

      if (mentions.length >= 2_000) {
        break;
      }
    }

    offset += line.length + 1;

    if (mentions.length >= 2_000) {
      break;
    }
  }

  // Longer aliases win when two concepts overlap; no nested or overlapping highlights.
  const sorted = mentions.sort(
    (a, b) => a.position - b.position || b.length - a.length || a.id.localeCompare(b.id),
  );

  let end = 0;

  return sorted.filter((item) => {
    if (item.position < end) {
      return false;
    }

    end = item.position + item.length;

    return true;
  });
}

function claimStatus(line: ResumeLine, position: number): ResumeSignal['status'] {
  const prefix = line.text.slice(Math.max(0, position - 70), position).toLowerCase();

  if (
    /\b(?:no(?: professional)? experience (?:with|in)|not (?:experienced|proficient) (?:with|in)|never used|do not know|don't know)\s*$/.test(
      prefix,
    )
  ) {
    return 'negated';
  }

  if (/\b(?:learning|studying|beginner (?:in|with)|exploring)\s*$/.test(prefix)) {
    return 'learning';
  }

  return ['experience', 'projects'].includes(line.section) ? 'work_evidenced' : 'mentioned';
}

export function detectSkills(lines: ResumeLine[]): ResumeSignal[] {
  const detected: ResumeSignal[] = [];

  for (const skill of patterns) {
    const evidence: ResumeSignal['evidence'] = [];
    const statuses: ResumeSignal['status'][] = [];
    const statusEvidence = new Map<ResumeSignal['status'], ResumeSignal['evidence'][number]>();

    for (const line of lines) {
      if (line.heading || line.section === 'header' || !line.text.trim()) {
        continue;
      }

      const match = skill.pattern.exec(line.text);

      if (!match) {
        continue;
      }

      if (
        skill.id === 'low-level' &&
        line.section !== 'skills' &&
        !/\b(?:programming|systems?|memory|threading|software|engineering|c\+\+)\b/i.test(line.text)
      ) {
        continue;
      }

      // Ordinary verbs must not become languages/frameworks outside explicit tech context.
      if (
        ['golang', 'react', 'rust', 'spark'].includes(skill.id) &&
        line.section !== 'skills' &&
        !/\b(?:built|developed|implemented|using|used|programming|language|framework|backend|frontend|services?)\b/i.test(
          line.text,
        )
      ) {
        continue;
      }

      const status = claimStatus(line, match.index + (match[1]?.length ?? 0));

      statuses.push(status);

      statusEvidence.set(status, {
        lineId: line.id,
        excerpt: line.text.trim(),
        rule: `skill:${skill.id}:${status}`,
      });

      if (evidence.length < 5) {
        evidence.push({
          lineId: line.id,
          excerpt: line.text.trim(),
          rule: `skill:${skill.id}:${status}`,
        });
      }
    }

    if (evidence.length) {
      const priority: ResumeSignal['status'][] = [
        'work_evidenced',
        'mentioned',
        'learning',
        'negated',
      ];

      const status = priority.find((value) => statuses.includes(value))!;

      if (!evidence.some((item) => item.rule.endsWith(`:${status}`))) {
        evidence[evidence.length - 1] = statusEvidence.get(status)!;
      }

      detected.push({
        id: skill.id,
        name: skill.name,
        status,
        evidence,
      });
    }
  }

  return detected;
}

const competencyPatterns: [string, string, RegExp][] = [
  [
    'leadership',
    'Team leadership',
    /\b(?:managed|led|supervised|leading)\s+(?:(?:a|the|multiple)\s+)?(?:teams?|group of (?:junior and senior )?engineers)\b/i,
  ],
  [
    'cross-functional-leadership',
    'Cross-functional leadership',
    /\b(?:led|leading|lead|managed)\b.{0,35}\b(?:cross[ -]functional|multiple teams|other teams)\b/i,
  ],
  [
    'mentoring',
    'Mentoring',
    /\bmentored\s+(?:\d+\s+)?(?:junior|engineers?|developers?|colleagues?|team members?)\b/i,
  ],
  [
    'stakeholder-communication',
    'Stakeholder communication',
    /\b(?:presented|communicated|coordinated|collaborated)\b.{0,60}\b(?:stakeholders?|clients?|executives?)\b/i,
  ],
  [
    'delivery-ownership',
    'Delivery ownership',
    /\b(?:owned|delivered|launched)\b.{0,60}\b(?:project|product|release|migration|platform)\b/i,
  ],
];

export function detectCompetencies(lines: ResumeLine[]): ResumeSignal[] {
  return competencyPatterns.flatMap(([id, name, pattern]) => {
    const evidence = lines
      .filter(
        (line) =>
          ['experience', 'projects', 'volunteering'].includes(line.section) &&
          pattern.test(line.text) &&
          !/\b(?:never|did not|didn't|not responsible)\b/i.test(line.text),
      )
      .slice(0, 5)
      .map((line) => ({ lineId: line.id, excerpt: line.text.trim(), rule: `competency:${id}` }));

    return evidence.length ? [{ id, name, status: 'work_evidenced' as const, evidence }] : [];
  });
}
