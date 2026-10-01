import type { Job } from '../model.js';
import { skillsInText, vocabularyVersion } from '../resume/vocabulary.js';

export const requirementsVersion = 'requirements-8';

export const featureVersion = `${requirementsVersion}:${vocabularyVersion}`;

export const supportedFunctions = ['engineering', 'data-ai', 'product', 'sales', 'people'];

export type Importance = 'required' | 'preferred' | 'contextual';

export interface RequirementEvidence {
  excerpt: string;
  line: number;
  rule: string;
}

export interface SkillRequirement {
  alternatives: { id: string; name: string }[];
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
    /^(?:minimum qualifications|basic qualifications|required qualifications|key qualifications|requirements|what you bring|what you(?:'|’)ll need|what we need to see|what we(?:'|’)re looking for|about you|qualifications|required skills|experience|education and training)\s*[:：]?$/i.test(
      text,
    )
  ) {
    return 'required';
  }

  if (
    /^(?:responsibilities|role details|about (?:us|the role)|what you(?:'|’)ll do|our (?:team|stack)|benefits|the role)\s*[:：]?$/i.test(
      text,
    )
  ) {
    return 'contextual';
  }

  return null;
}

function importance(text: string, section: Importance): Importance {
  if (
    /\b(?:we offer|offers?[^.!?]{0,80}\bbenefits|benefits include|(?:health|dental|vision) insurance|paid (?:time off|leave)|(?:salary|compensation) range)\b/i.test(
      text,
    )
  ) {
    return 'contextual';
  }

  if (/\b(?:not required|optional|nice.to.have|preferred|a plus|bonus)\b/i.test(text)) {
    return 'preferred';
  }

  if (
    /\b(?:we (?:use|work with)|our (?:stack|team)|you will|you'll|responsibilities)\b/i.test(text)
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

  for (const [index, raw] of lines.entries()) {
    const text = raw.replace(/^\s*[•*\-]\s*/, '').trim();
    const nextSection = heading(text);

    if (nextSection) {
      section = nextSection;
      continue;
    }

    // Sentence boundaries prevent contextual stack statements inheriting later requirements.
    for (const sentence of text.split(/(?<=[.!?])\s+(?=[A-Z])/)) {
      const level = importance(sentence, section);

      const evidence = {
        excerpt: sentence.slice(0, 2_000),
        line: index + 1,
        rule: `requirements:${level}`,
      };

      const skills = skillsInText(sentence);
      const groups: SkillRequirement[] = [];

      for (const [position, skill] of skills.entries()) {
        const previous = skills[position - 1];

        const connector = previous
          ? sentence.slice(previous.position + previous.length, skill.position)
          : '';

        const alternative = previous && /^\s*(?:,?\s*or|\/)\s*$/i.test(connector);

        if (alternative) {
          groups.at(-1)!.alternatives.push({ id: skill.id, name: skill.name });

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
            alternatives: [{ id: skill.id, name: skill.name }],
            importance: level,
            evidence,
          });
        }
      }

      result.skills.push(...groups);

      const tenure =
        /(\d{1,2})(?:\s*(?:[-–]|to)\s*\d{1,2})?\s*\+?\s*years?\s+(?:of\s+)?(?:[\w /-]{0,50}?)experience\b/i.exec(
          sentence,
        ) ??
        /\b(?:at least|minimum(?: of)?)\s+(\d{1,2})\s*\+?\s*years?\s+(?:of\s+)?(?:[\w /-]{0,40})(?:engineering|development|sales|recruiting|product management)\b/i.exec(
          sentence,
        );

      if (tenure && level !== 'contextual') {
        const leadershipTenure =
          /\b(?:(?:managing|leading|supervising|mentoring) (?:a group of |a team of |a |the )?(?:teams?|people|(?:junior and senior )?engineers|others)|people management|team leadership)\b/i.test(
            sentence,
          );

        const scope = leadershipTenure
          ? 'skill'
          : /\b(?:professional|total|overall|industry)\b/i.test(tenure[0])
            ? 'professional'
            : /\b(?:with|using|in)\b/i.test(sentence.slice(tenure.index + tenure[0].length)) &&
                skills.length > 0
              ? 'skill'
              : 'function';

        result.experience.push({
          minimumMonths: Number(tenure[1]) * 12,
          scope,
          skillId: leadershipTenure
            ? 'leadership'
            : scope === 'skill' && skills.length === 1
              ? skills[0]!.id
              : null,
          importance: level,
          evidence,
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
        !tenure &&
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
            .map((skill) => skill.id)
            .sort()
            .join('|') ===
            group.alternatives
              .map((skill) => skill.id)
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
    'Rules cover explicit English statements. Unrecognized or ambiguous requirements remain in the original description.',
  );

  return result;
}
