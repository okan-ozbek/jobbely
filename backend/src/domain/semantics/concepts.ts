import { coreSkills, coreCompetencies } from './core.js';
import { engineeringPacks } from './engineering.js';
import type { Concept, ConceptKind, SkillFacet } from './model.js';

export const registryVersion = 'concepts-3';

const languages = new Set([
  'typescript',
  'javascript',
  'java',
  'scala',
  'c',
  'php',
  'kotlin',
  'python',
  'golang',
  'rust',
  'csharp',
  'cpp',
  'html',
  'css',
  'sql',
]);

const platforms = new Set(['aws', 'azure', 'gcp']);

const tools = new Set([
  'react',
  'angular',
  'vue',
  'nodejs',
  'postgresql',
  'mysql',
  'mongodb',
  'redis',
  'git',
  'docker',
  'kubernetes',
  'terraform',
  'linux',
  'pytorch',
  'tensorflow',
  'pandas',
  'spark',
  'excel',
  'tableau',
  'power-bi',
  'figma',
  'salesforce',
  'hubspot',
  'dbt',
  'hris',
  'kafka',
  'rabbitmq',
  'dynamodb',
  'grpc',
]);

function concept(
  [id, name, aliases]: [string, string, string[]],
  kind: ConceptKind,
  family: string,
): Concept {
  return {
    id,
    name,
    aliases: [...new Set([name, ...aliases])].sort((a, b) => b.length - a.length),
    kind,
    family,
    definition:
      kind === 'tool' || kind === 'platform'
        ? `Use of ${name}; developing its internals requires separate evidence.`
        : `Evidence of ${name}; adjacent concepts do not establish full coverage.`,
    facets: kind === 'tool' ? ['usage', 'development'] : ['general'],
    provenance: 'reviewed-local',
  };
}

export const concepts: readonly Concept[] = [
  ...coreSkills.map((row) =>
    concept(
      row,
      languages.has(row[0])
        ? 'language'
        : platforms.has(row[0])
          ? 'platform'
          : tools.has(row[0])
            ? 'tool'
            : 'capability',
      'core',
    ),
  ),
  ...coreCompetencies.map((row) => concept(row, 'competency', 'delivery')),
  ...engineeringPacks.flatMap((pack) =>
    pack.entries.map((row) => concept(row, pack.kind, pack.family)),
  ),
];

export const conceptsById = new Map(concepts.map((item) => [item.id, item]));

export function defaultFacet(id: string): SkillFacet {
  return conceptsById.get(id)?.kind === 'tool' ? 'usage' : 'general';
}

export function resolveConcept(name: string) {
  const key = name.trim().toLowerCase();
  const found = concepts.find((item) => item.aliases.some((alias) => alias.toLowerCase() === key));

  return found ? { id: found.id, name: found.name } : null;
}
