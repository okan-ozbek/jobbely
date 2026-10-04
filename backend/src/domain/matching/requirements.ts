import { readJobDocument, jobDocumentVersion, isQualificationBlock } from './document.js';
import type { JobDocument, JobBlock } from './document.js';
import { actionIn, outcomeIn } from '../semantics/propositions.js';
import type { EvidenceAction, EvidenceOutcome } from '../semantics/propositions.js';
import type { Interpretation, SkillFacet } from '../semantics/model.js';
import type { Job } from '../model.js';
import { skillsInText, vocabularyVersion } from '../resume/vocabulary.js';

export const requirementsVersion = 'requirements-13';

export const featureVersion = `${requirementsVersion}:${vocabularyVersion}:${jobDocumentVersion}`;

export const supportedFunctions = ['engineering', 'data-ai', 'product', 'sales', 'people'];

export type Importance = 'required' | 'preferred' | 'contextual';

export interface RequirementEvidence {
  blockId?: string;
  clauseId?: string;
  start?: number;
  end?: number;
  excerpt: string;
  line: number;
  rule: string;
}

export interface SkillRequirement {
  id?: string;
  logic?: 'single' | 'any-of';
  unresolvedAlternatives?: string[];
  alternatives: { id: string; name: string; facet?: SkillFacet; interpretation?: Interpretation }[];
  importance: Importance;
  evidence: RequirementEvidence;
}

export interface RequirementClause {
  id: string;
  blockId: string;
  importance: Importance;
  role: JobBlock['role'];
  action: EvidenceAction;
  objectIds: string[];
  outcome: EvidenceOutcome;
  modality: 'obligation' | 'preference' | 'description' | 'conditional';
  polarity: 'positive' | 'negated' | 'uncertain';
  logic: 'all-of' | 'any-of';
  groupIds: string[];
  unresolvedAlternatives: string[];
  evidence: RequirementEvidence;
}

export interface JobRequirements {
  documentVersion: string;
  blocks: JobBlock[];
  clauses: RequirementClause[];
  version: string;
  contentHash: string;
  category: string;
  skills: SkillRequirement[];
  experience: {
    minimumMonths: number;
    maximumMonths?: number;
    alternativeIds?: string[];
    scope: 'professional' | 'function' | 'skill';
    skillId: string | null;
    importance: Importance;
    evidence: RequirementEvidence;
  }[];
  constraints: {
    kind: 'location' | 'authorization' | 'qualification' | 'language';
    importance: Importance;
    evidence: RequirementEvidence;
  }[];
  unparsed: { importance: Importance; evidence: RequirementEvidence }[];
  locations: string[];
  workplace: Job['workplace'];
  warnings: string[];
  truncated: boolean;
}

function importance(text: string, section: Importance): Importance {
  if (
    /\b(?:equal opportunity|equal employment|all qualified applicants|ethical hiring|recruitment fees|(?:we|employers?) (?:do not|never) charge|salary range|we offer|offers?[^.!?]{0,80}\bbenefits|benefits include|(?:health|dental|vision) insurance|paid (?:time off|leave)|(?:salary|compensation) range)\b/i.test(
      text,
    )
  ) {
    return 'contextual';
  }

  if (
    /\b(?:not required|optional|nice.to.have|preferred|preferably|ideally|a plus|bonus)\b/i.test(
      text,
    )
  ) {
    return 'preferred';
  }

  if (
    /\b(?:we (?:use|work with)|(?:our|the) (?:platform|company|product|team) (?:uses?|runs?|supports?|provides?|implements?|keeps?)|our (?:stack|team)|you will|you'll|responsibilities)\b/i.test(
      text,
    )
  ) {
    return 'contextual';
  }

  if (/\b(?:must|required)\b/i.test(text)) {
    return 'required';
  }

  if (section === 'preferred') {
    return 'preferred';
  }

  if (
    /\b(?:must|required|at least \d+\s*\+?\s*years?|minimum (?:of )?\d+\s*years?|proficiency (?:in|with)|proficient (?:in|with)|experience (?:in|with|developing|building|working)|knowledge of|you (?:have|bring))\b/i.test(
      text,
    )
  ) {
    return 'required';
  }

  return section;
}

const requirementGrammar = new Set(
  'the ideal candidate you your must have has with in of for to at a an and or either is are be required preferred proficient proficiency knowledge experience experienced using use used strong solid excellent good working work practical hands on demonstrated proven skill skills ability abilities expertise technical technology technologies programming language languages framework frameworks database databases system systems familiarity familiar basic advanced understanding fluency foundational developing building supporting preferably ideally pipelines platform platforms on production level similar one any software years large scale maintaining scalable'.split(
    ' ',
  ),
);

function remainingSkillStatement(sentence: string, skills: ReturnType<typeof skillsInText>) {
  const characters = sentence.split('');

  for (const skill of skills) {
    for (let offset = skill.position; offset < skill.position + skill.length; offset++) {
      characters[offset] = ' ';
    }
  }

  let remainder = characters.join('');

  for (const unknown of /\bor\b|\bone of\b/i.test(sentence)
    ? unresolvedAlternatives(sentence, skills)
    : []) {
    remainder = remainder.replace(unknown, ' ');
  }

  return (
    remainder
      .toLowerCase()
      .match(/[\p{L}]+/gu)
      ?.some((word) => !requirementGrammar.has(word)) ?? false
  );
}

export function extractRequirements(
  job: Pick<Job, 'descriptionText' | 'contentHash' | 'classification' | 'locations' | 'workplace'>,
  document: JobDocument = readJobDocument(job.descriptionText),
): JobRequirements {
  const result: JobRequirements = {
    documentVersion: document.version,
    blocks: document.blocks,
    clauses: [],
    version: featureVersion,
    contentHash: job.contentHash,
    category: job.classification.category,
    skills: [],
    experience: [],
    constraints: [],
    unparsed: [],
    locations: job.locations,
    workplace: job.workplace,
    warnings: [],
    truncated: false,
  };

  if (document.truncated) {
    result.warnings.push(
      'Description exceeds the extraction limit; requirements need manual review.',
    );

    result.truncated = true;

    return result;
  }

  for (const block of document.blocks) {
    if (block.kind === 'heading') {
      continue;
    }

    const raw = block.text;
    const lineStart = block.start;
    const index = block.line - 1;
    const text = raw.replace(/^\s*[•*\-]\s*/, '').trim();
    const section = block.importance;

    let sentenceSearch = 0;

    // Sentence boundaries prevent contextual stack statements inheriting later requirements.
    for (const sentence of requirementSentences(text)) {
      const sentencePosition = text.indexOf(sentence, sentenceSearch);

      sentenceSearch = sentencePosition + sentence.length;

      const sentenceStart = lineStart + Math.max(0, raw.indexOf(text)) + sentencePosition;
      const level = isQualificationBlock(block) ? importance(sentence, section) : 'contextual';
      const clauseId = `${block.id}-clause-${sentencePosition}`;

      const evidence = {
        blockId: block.id,
        clauseId,
        excerpt: sentence.slice(0, 2_000),
        line: index + 1,
        rule: `requirements:${level}`,
        start: sentenceStart,
        end: sentenceStart + sentence.length,
      };

      const recognized = ['application', 'legal', 'benefits', 'compensation', 'overview'].includes(
        block.role,
      )
        ? []
        : skillsInText(sentence);

      // One interpreted activity contributes once, even when the recognizer emits related concepts.
      const skills = recognized.filter(
        (item, position) =>
          !recognized
            .slice(0, position)
            .some(
              (previous) =>
                previous.position <= item.position &&
                previous.position + previous.length >= item.position + item.length &&
                previous.rule.startsWith('clause:') &&
                !/inference-training|training-inference/.test(previous.rule),
            ),
      );

      const groups: SkillRequirement[] = [];

      const alternativeList =
        /\b(?:one of|either|any of)\b/i.test(sentence) || /\bor\b/i.test(sentence);

      const unknownAlternatives =
        alternativeList && skills.length ? unresolvedAlternatives(sentence, skills) : [];

      for (const [position, skill] of skills.entries()) {
        const previous = skills[position - 1];

        const connector = previous
          ? sentence.slice(previous.position + previous.length, skill.position)
          : '';

        const alternative =
          previous &&
          (/^\s*(?:,?\s*or(?:\s+(?:with|in|on|using))?|\/)\s*$/i.test(connector) ||
            (alternativeList &&
              /^\s*,[^.;:]*$/i.test(connector) &&
              !/\b(?:and|must|experience|required|with|in)\b/i.test(connector)));

        if (alternative) {
          groups.at(-1)!.logic = 'any-of';

          groups.at(-1)!.alternatives.push({
            id: skill.id,
            name: skill.name,
            facet: skill.facet,
            interpretation: skill.interpretation,
          });

          let preceding = position - 1;

          while (
            preceding > 0 &&
            /^\s*,\s*$/.test(
              sentence.slice(
                skills[preceding - 1]!.position + skills[preceding - 1]!.length,
                skills[preceding]!.position,
              ),
            ) &&
            groups.length >= 2
          ) {
            const last = groups.pop()!;

            groups.at(-1)!.alternatives.push(...last.alternatives);
            preceding--;
          }
        } else {
          groups.push({
            id: `${clauseId}-group-${position}`,
            logic: alternativeList && position === 0 ? 'any-of' : 'single',
            unresolvedAlternatives: alternativeList && position === 0 ? unknownAlternatives : [],
            alternatives: [
              {
                id: skill.id,
                name: skill.name,
                facet: skill.facet,
                interpretation: skill.interpretation,
              },
            ],
            importance: level,
            evidence: {
              ...evidence,
              rule: `requirements:${level}:${skill.rule}`,
            },
          });
        }
      }

      result.skills.push(...groups);

      result.clauses.push({
        id: clauseId,
        blockId: block.id,
        importance: level,
        role: block.role,
        action: actionIn(sentence),
        objectIds: skills.map((item) => item.id),
        outcome: outcomeIn(sentence),
        modality: /\b(?:if|when|unless)\b/i.test(sentence)
          ? 'conditional'
          : level === 'required'
            ? 'obligation'
            : level === 'preferred'
              ? 'preference'
              : 'description',
        polarity: /\b(?:not required|no experience|without experience)\b/i.test(sentence)
          ? 'negated'
          : skills.some((item) => item.interpretation === 'ambiguous')
            ? 'uncertain'
            : 'positive',
        logic: groups.length === 1 && groups[0]?.logic === 'any-of' ? 'any-of' : 'all-of',
        groupIds: groups.map((group) => group.id!),
        unresolvedAlternatives: unknownAlternatives,
        evidence,
      });

      const tenures = [
        ...sentence.matchAll(
          /(\d{1,2})(?:\s*(?:[-–]|to)\s*(\d{1,2}))?\s*\+?\s*years?\s+(?:of\s+)?/gi,
        ),
      ];

      let hasTenure = false;

      const alternativeTenure =
        tenures.length > 1 &&
        tenures.some((tenure, index) =>
          /\bor\b/i.test(
            sentence.slice(
              tenure.index + tenure[0].length,
              tenures[index + 1]?.index ?? sentence.length,
            ),
          ),
        );

      if (alternativeTenure && level !== 'contextual') {
        result.unparsed.push({
          importance: level,
          evidence: { ...evidence, rule: 'requirements:alternative-tenure' },
        });
      }

      for (const [tenureIndex, tenure] of tenures.entries()) {
        const activity = sentence.slice(
          tenure.index + tenure[0].length,
          tenures[tenureIndex + 1]?.index ?? sentence.length,
        );

        if (
          !/\b(?:experience|engineering|development|sales|recruiting|product management|building|designing|supporting|managing|leading|supervising|mentoring)\b/i.test(
            activity,
          )
        ) {
          continue;
        }

        hasTenure = true;

        if (level === 'contextual' || alternativeTenure) {
          continue;
        }

        const leadershipTenure =
          /\b(?:(?:managing|leading|supervising|mentoring) (?:a group of |a team of |a |the )?(?:teams?|people|(?:junior and senior )?engineers|others)|people management|team leadership)\b/i.test(
            activity,
          );

        const localSkills = skillsInText(activity);

        const scope = leadershipTenure
          ? 'skill'
          : /\b(?:professional|total|overall|industry)\b/i.test(activity)
            ? 'professional'
            : /\b(?:with|using|in)\b/i.test(activity) && localSkills.length > 0
              ? 'skill'
              : 'function';

        result.experience.push({
          minimumMonths: Number(tenure[1]) * 12,
          ...(tenure[2] ? { maximumMonths: Number(tenure[2]) * 12 } : {}),
          ...(alternativeList ? { alternativeIds: skills.map((item) => item.id) } : {}),
          scope,
          skillId: leadershipTenure
            ? 'leadership'
            : scope === 'skill' && localSkills.length === 1
              ? localSkills[0]!.id
              : null,
          importance: level,
          evidence: {
            ...evidence,
            start: sentenceStart + tenure.index,
            end: sentenceStart + tenure.index + tenure[0].length + activity.length,
            excerpt: `${tenure[0]}${activity}`.slice(0, 2_000),
          },
        });
      }

      const constraint =
        /\b(?:must (?:be (?:based|located)|reside|live)|based in|residents? of|remote (?:only )?(?:in|within|from)|on[ -]?site (?:in|at)|hybrid in|work from|relocat(?:e|ion) to)\b/i.test(
          sentence,
        )
          ? 'location'
          : /\b(?:authorized to work|work authorization|visa|sponsorship|work permit|citizenship|export.controlled|government license)\b/i.test(
                sentence,
              )
            ? 'authorization'
            : /\b(?:bachelor|master|degree|ph\.?d|BS|BSc|MS|MSc)\b/i.test(sentence)
              ? 'qualification'
              : /\b(?:fluent|fluency|native speaker|language proficiency)\b/i.test(sentence)
                ? 'language'
                : null;

      if (constraint) {
        const restriction =
          constraint === 'location' ||
          (constraint === 'authorization' &&
            /\b(?:no|cannot|not available|not provided|authorized to work|work permit required|export.controlled|government license)\b/i.test(
              sentence,
            ));

        result.constraints.push({
          kind: constraint,
          importance: level === 'contextual' && restriction ? 'required' : level,
          evidence,
        });
      }

      if (
        sentence.length > 8 &&
        level !== 'contextual' &&
        !hasTenure &&
        !constraint &&
        (!skills.length || remainingSkillStatement(sentence, skills))
      ) {
        result.unparsed.push({
          importance: level,
          evidence: { ...evidence, rule: 'requirements:unparsed' },
        });
      }
    }
  }

  // Repeated boilerplate does not add weight. Keep distinct evidence in the description.
  const groupKeys = new Map<string, SkillRequirement>();
  const aliases = new Map<string, string>();

  for (const group of result.skills) {
    const key = `${group.importance}:${group.logic}:${group.alternatives
      .map((skill) => `${skill.id}:${skill.facet ?? 'general'}`)
      .sort()
      .join('|')}:${(group.unresolvedAlternatives ?? []).join('|')}`;

    const previous = groupKeys.get(key);

    if (previous) {
      aliases.set(group.id!, previous.id!);
    } else {
      groupKeys.set(key, group);
    }
  }

  result.skills = [...groupKeys.values()];

  for (const clause of result.clauses) {
    clause.groupIds = [...new Set(clause.groupIds.map((id) => aliases.get(id) ?? id))];
  }

  result.truncated =
    result.clauses.some(
      (clause) => (clause.evidence.end ?? 0) - (clause.evidence.start ?? 0) > 2_000,
    ) ||
    result.skills.length > 200 ||
    result.experience.length > 30 ||
    result.constraints.length > 40 ||
    result.unparsed.length > 40 ||
    result.clauses.length > 400;

  if (result.truncated) {
    result.warnings.push('Requirement bounds exceeded. This job needs manual review.');
  }

  result.clauses = result.clauses.slice(0, 400);
  result.skills = result.skills.slice(0, 200);
  result.experience = result.experience.slice(0, 30);
  result.constraints = result.constraints.slice(0, 40);
  result.unparsed = result.unparsed.slice(0, 40);

  result.warnings.push(
    'Rules cover reviewed English keywords and activities. Unrecognized or ambiguous requirements remain in the original description.',
  );

  return result;
}

function unresolvedAlternatives(
  sentence: string,
  skills: ReturnType<typeof skillsInText>,
): string[] {
  const list = sentence.split(/\b(?:one of|either|any of)\s*:?[ ]*/i).at(-1)!;

  return list
    .split(/,|\bor\b|\//i)
    .map((part) => part.trim().replace(/\.$/, ''))
    .filter(
      (part) =>
        part &&
        !skills.some(
          (skill) =>
            part.toLowerCase().includes(skill.name.toLowerCase()) ||
            skillsInText(part).some((mention) => mention.id === skill.id),
        ) &&
        !/^(?:required|preferred)$/i.test(part),
    )
    .slice(0, 10)
    .map((part) => part.slice(0, 100));
}

function requirementSentences(text: string): string[] {
  const boundary =
    /(?<=[.!?])\s+(?=[A-Z])|,\s+(?=(?:[Pp]referably|[Ii]deally|[Nn]ice.to.have|[Pp]referred)\b)|\s+(?=(?:[Pp]referably|[Ii]deally)\b)/g;

  const parts: string[] = [];
  let start = 0;

  for (const match of text.matchAll(boundary)) {
    if (/\b(?:e\.g|i\.e|vs|Mr|Ms|Dr)\.$/i.test(text.slice(0, match.index))) {
      continue;
    }

    parts.push(text.slice(start, match.index));
    start = match.index + match[0].length;
  }

  parts.push(text.slice(start));

  return parts.filter(Boolean);
}
