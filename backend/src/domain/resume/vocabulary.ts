import type { ResumeLine, ResumeSignal } from './model.js';

export const vocabularyVersion = 'starter-1';

// Deliberately reviewed starter coverage, not a claim of universal skill recognition.
const definitions: [string, string, string[]][] = [
  ['typescript', 'TypeScript', ['TypeScript']],
  ['javascript', 'JavaScript', ['JavaScript', 'ECMAScript']],
  ['java', 'Java', ['Java']],
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
  ['spark', 'Apache Spark', ['Apache Spark', 'PySpark']],
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
];

export const supportedSkills = definitions.map(([id, name]) => ({ id, name }));

export function resolveSkill(name: string) {
  const key = name.trim().toLowerCase();

  const definition = definitions.find(([, label, aliases]) =>
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

      // Ordinary verbs must not become languages/frameworks outside explicit tech context.
      if (
        ['golang', 'react', 'rust'].includes(skill.id) &&
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
  ['leadership', 'Team leadership', /\b(?:managed|led|supervised)\s+(?:a\s+)?team\b/i],
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
