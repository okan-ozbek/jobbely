import type { Interpretation, SkillFacet } from '../semantics/model.js';
import type { Job } from '../model.js';
import { skillsInText, vocabularyVersion } from '../resume/vocabulary.js';

export const requirementsVersion = 'requirements-10';

export const featureVersion = `${requirementsVersion}:${vocabularyVersion}`;

export const supportedFunctions = ['engineering', 'data-ai', 'product', 'sales', 'people'];

export type Importance = 'required' | 'preferred' | 'contextual';

export interface RequirementEvidence {
  start?: number;
  end?: number;
  excerpt: string;
  line: number;
  rule: string;
}

export interface SkillRequirement {
  alternatives: { id: string; name: string; facet?: SkillFacet; interpretation?: Interpretation }[];
  importance: Importance;
  evidence: RequirementEvidence;
}

export interface JobRequirements {
  version: string;
  contentHash: string;
  category: string;
  skills: SkillRequirement[];
  experience: {
    minimumMonths: number;
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

function heading(text: string): Importance | null {
  if (/^our ideal .{1,100} will have\s*[:：]?$/i.test(text)) {
    return 'required';
  }

  if (/^(?:as (?:a|an) .{1,100} you will|why join .{1,100})\s*[:：?]?$/i.test(text)) {
    return 'contextual';
  }

  if (
    /^(?:preferred qualifications|preferred experience|nice to haves?|bonus(?: points)?|desirable|preferred skills)\s*[:：]?$/i.test(
      text,
    )
  ) {
    return 'preferred';
  }

  if (
    /^(?:minimum requirements|minimum qualifications|basic qualifications|required qualifications|key qualifications|requirements|what you bring|what you(?:'|’)ll need|what we need to see|what we(?:'|’)re looking for|about you|qualifications|required skills|experience|education and training)\s*[:：]?$/i.test(
      text,
    )
  ) {
    return 'required';
  }

  if (
    /^(?:key responsibilities|responsibilities|job details|job description|role overview|job type|shift|primary location|additional locations|posting statement|position of trust|work model for this role|additional information|role details|about (?:us|the role)|what you(?:'|’)ll do|our (?:team|stack)|benefits|the role)\s*[:：]?$/i.test(
      text,
    )
  ) {
    return 'contextual';
  }

  return null;
}

function importance(text: string, section: Importance): Importance {
  if (
    /\b(?:equal opportunity|equal employment|all qualified applicants|ethical hiring|recruitment fees|(?:we|employers?) (?:do not|never) charge|salary range|we offer|offers?[^.!?]{0,80}\bbenefits|benefits include|(?:health|dental|vision) insurance|paid (?:time off|leave)|(?:salary|compensation) range)\b/i.test(
      text,
    )
  ) {
    return 'contextual';
  }

  if (/\b(?:not required|optional|nice.to.have|preferred|a plus|bonus)\b/i.test(text)) {
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
    /\b(?:must|required|at least \d+\s*\+?\s*years?|minimum (?:of )?\d+\s*years?|proficiency (?:in|with)|proficient (?:in|with)|experience (?:in|with)|knowledge of|you (?:have|bring))\b/i.test(
      text,
    )
  ) {
    return 'required';
  }

  return section;
}

const requirementGrammar = new Set(
  'the ideal candidate you your must have has with in of for to at a an and or either is are be required preferred proficient proficiency knowledge experience experienced using use used strong solid excellent good working work practical hands on demonstrated proven skill skills ability abilities expertise technical technology technologies programming language languages framework frameworks database databases system systems familiarity familiar basic advanced understanding fluency'.split(
    ' ',
  ),
);

function remainingSkillStatement(sentence: string, skills: ReturnType<typeof skillsInText>) {
  let remainder = sentence;

  for (const skill of [...skills].reverse()) {
    remainder =
      remainder.slice(0, skill.position) +
      ' '.repeat(skill.length) +
      remainder.slice(skill.position + skill.length);
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
): JobRequirements {
  const result: JobRequirements = {
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

  let section: Importance = 'contextual';

  if (job.descriptionText.length > 200_000) {
    result.warnings.push(
      'Description exceeds the extraction limit; requirements need manual review.',
    );

    result.truncated = true;

    return result;
  }

  const lines = job.descriptionText.split(/\r?\n/);

  let offset = 0;

  for (const [index, raw] of lines.entries()) {
    const lineStart = offset;

    offset += raw.length + (job.descriptionText[offset + raw.length] === '\r' ? 2 : 1);

    const text = raw.replace(/^\s*[•*\-]\s*/, '').trim();
    const nextSection = heading(text);

    if (nextSection) {
      section = nextSection;
      continue;
    }

    let sentenceSearch = 0;

    // Sentence boundaries prevent contextual stack statements inheriting later requirements.
    for (const sentence of text.split(/(?<=[.!?])\s+(?=[A-Z])/)) {
      const sentencePosition = text.indexOf(sentence, sentenceSearch);

      sentenceSearch = sentencePosition + sentence.length;

      const sentenceStart = lineStart + Math.max(0, raw.indexOf(text)) + sentencePosition;
      const level = importance(sentence, section);

      const evidence = {
        excerpt: sentence.slice(0, 2_000),
        line: index + 1,
        rule: `requirements:${level}`,
        start: sentenceStart,
        end: sentenceStart + sentence.length,
      };

      const recognized = skillsInText(sentence);

      // One interpreted activity contributes once, even when the recognizer emits related concepts.
      const skills = recognized.filter(
        (item, position) =>
          !recognized
            .slice(0, position)
            .some(
              (previous) =>
                previous.position <= item.position &&
                previous.position + previous.length >= item.position + item.length &&
                previous.rule.startsWith('clause:'),
            ),
      );

      const groups: SkillRequirement[] = [];

      for (const [position, skill] of skills.entries()) {
        const previous = skills[position - 1];

        const connector = previous
          ? sentence.slice(previous.position + previous.length, skill.position)
          : '';

        const alternative = previous && /^\s*(?:,?\s*or|\/)\s*$/i.test(connector);

        if (alternative) {
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
              start: sentenceStart + skill.position,
              end: sentenceStart + skill.position + skill.length,
            },
          });
        }
      }

      result.skills.push(...groups);

      const tenures = [
        ...sentence.matchAll(
          /(\d{1,2})(?:\s*(?:[-–]|to)\s*\d{1,2})?\s*\+?\s*years?\s+(?:of\s+)?/gi,
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
          scope,
          skillId: leadershipTenure
            ? 'leadership'
            : scope === 'skill' && localSkills.length === 1
              ? localSkills[0]!.id
              : null,
          importance: level,
          evidence: { ...evidence, excerpt: `${tenure[0]}${activity}`.slice(0, 2_000) },
        });
      }

      const constraint =
        /\b(?:must (?:be (?:based|located)|reside|live)|based in|residents? of|remote (?:only )?(?:in|within|from)|on[ -]?site (?:in|at)|hybrid in|work from|relocat(?:e|ion) to)\b/i.test(
          sentence,
        )
          ? 'location'
          : /\b(?:authorized to work|work authorization|visa|sponsorship|work permit|citizenship)\b/i.test(
                sentence,
              )
            ? 'authorization'
            : /\b(?:bachelor|master|degree|ph\.?d)\b/i.test(sentence)
              ? 'qualification'
              : /\b(?:fluent|fluency|native speaker|language proficiency)\b/i.test(sentence)
                ? 'language'
                : null;

      if (constraint) {
        const restriction =
          constraint === 'location' ||
          (constraint === 'authorization' &&
            /\b(?:no|cannot|not available|not provided|authorized to work|work permit required)\b/i.test(
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
  result.skills = result.skills.filter(
    (group, index, all) =>
      all.findIndex(
        (item) =>
          item.importance === group.importance &&
          item.alternatives
            .map((skill) => `${skill.id}:${skill.facet ?? 'general'}`)
            .sort()
            .join('|') ===
            group.alternatives
              .map((skill) => `${skill.id}:${skill.facet ?? 'general'}`)
              .sort()
              .join('|'),
      ) === index,
  );

  result.truncated =
    result.skills.length > 200 ||
    result.experience.length > 30 ||
    result.constraints.length > 40 ||
    result.unparsed.length > 40;

  if (result.truncated) {
    result.warnings.push('Requirement bounds exceeded. This job needs manual review.');
  }

  result.skills = result.skills.slice(0, 200);
  result.experience = result.experience.slice(0, 30);
  result.constraints = result.constraints.slice(0, 40);
  result.unparsed = result.unparsed.slice(0, 40);

  result.warnings.push(
    'Rules cover reviewed English keywords and activities. Unrecognized or ambiguous requirements remain in the original description.',
  );

  return result;
}
