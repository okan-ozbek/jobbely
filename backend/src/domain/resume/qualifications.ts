import { skillsInText } from './vocabulary.js';
import type { ResumeLine } from './model.js';

export type DegreeLevel = 'bachelor' | 'master' | 'doctorate';

export type DegreeField =
  'computer-science' | 'engineering' | 'mathematics' | 'physics' | 'business' | 'other' | 'unknown';

export interface EducationClaim {
  level: DegreeLevel;
  field: DegreeField;
  completion: 'completed' | 'in-progress' | 'unknown';
}

export interface SkillTenureClaim {
  skillId: string;
  months: number;
}

export const degreeRank = { bachelor: 1, master: 2, doctorate: 3 };

export const degreeNames = {
  bachelor: 'Bachelor’s degree',
  master: 'Master’s degree',
  doctorate: 'Doctorate',
};

export function degreeField(text: string): DegreeField {
  if (
    /\b(?:computer science|computing|informatics|information technology|software engineering|computer engineering)\b/i.test(
      text,
    )
  ) {
    return 'computer-science';
  }

  if (/\b(?:engineering|engineer)\b/i.test(text)) {
    return 'engineering';
  }

  if (/\b(?:mathematics|math|maths|statistics)\b/i.test(text)) {
    return 'mathematics';
  }

  if (/\bphysics\b/i.test(text)) {
    return 'physics';
  }

  if (/\b(?:business|economics|finance|management)\b/i.test(text)) {
    return 'business';
  }

  return /\b(?:in|of)\s+(?:arts|science|engineering)\b/i.test(text)
    ? 'unknown'
    : /\b(?:in|of)\s+[a-z]+/i.test(text)
      ? 'other'
      : 'unknown';
}

export function degreeMentions(text: string) {
  return [
    ...text.matchAll(
      /\b(?:bachelor(?:['’]s|s)?(?:\s+degree)?|master(?:['’]s|s)?(?:\s+degree)?|doctorate|doctoral\s+degree|Ph\.?D\.?|B\.?Sc\.?|B\.?S\.?|B\.?A\.?|M\.?Sc\.?|M\.?S\.?|M\.?A\.?)\b/gi,
    ),
  ]
    .filter((match) => {
      // Lower-case ms/ma/ba are ordinary words/units, not education evidence.
      return match[0].length > 4 || /[A-Z]/.test(match[0]);
    })
    .map((match) => ({
      level: (/^(?:master|M)/i.test(match[0])
        ? 'master'
        : /^(?:Ph|doctor)/i.test(match[0])
          ? 'doctorate'
          : 'bachelor') as DegreeLevel,
      position: match.index,
      length: match[0].length,
    }));
}

export function detectEducation(lines: ResumeLine[], analysisDate: string): EducationClaim[] {
  const claims = lines
    .filter(
      (line) =>
        !line.heading &&
        (line.section === 'education' ||
          /\b(?:degree|bachelor|master|doctorate|Ph\.?D|(?:BS|BSc|BA|MS|MSc|MA)\s+in)\b/i.test(
            line.text,
          )),
    )
    .flatMap((line) => {
      // Separate multiple qualifications on one line before associating subjects and dates.
      return line.text.split(/\s*[;|]\s*/).flatMap((text) => {
        const completion: EducationClaim['completion'] =
          /\b(?:incomplete|dropped out|not completed|no degree|without|no|not earned)\b/i.test(text)
            ? 'unknown'
            : /\b(?:pursuing|studying|expected|in progress|candidate|enrolled|currently)\b/i.test(
                  text,
                ) ||
                [...text.matchAll(/\b(20\d{2})\b/g)].some(
                  (match) => match[1]! > analysisDate.slice(0, 4),
                )
              ? 'in-progress'
              : 'completed';

        return degreeMentions(text).map((mention) => ({
          level: mention.level,
          field: degreeField(text),
          completion,
        }));
      });
    });

  return [...new Map(claims.map((claim) => [JSON.stringify(claim), claim])).values()].slice(0, 20);
}

// Only explicit duration claims establish tool tenure. A skill appearing under a dated role
// does not establish that it was used for the whole role, and inferred relations never add years.
export function detectSkillTenure(lines: ResumeLine[]): SkillTenureClaim[] {
  const claims: SkillTenureClaim[] = [];

  for (const line of lines) {
    if (
      line.section === 'education' ||
      line.section === 'projects' ||
      line.section === 'volunteering'
    ) {
      continue;
    }

    for (const sentence of line.text.split(/[;.!?]\s+/)) {
      const duration = sentence.match(
        /\b(\d{1,2}(?:\.\d)?)\s*\+?\s*years?\s+(?:of\s+)?(?:professional\s+|production\s+|hands[ -]on\s+)?experience\s+(?:with|in|using)\s+/i,
      );

      if (
        !duration ||
        /\b(?:learning|studying|no experience|not|projects?|internships?)\b/i.test(sentence)
      ) {
        continue;
      }

      const skills = [
        ...new Set(
          skillsInText(sentence.slice(duration.index! + duration[0].length))
            .filter((skill) => skill.interpretation === 'explicit')
            .map((skill) => skill.id),
        ),
      ];

      if (skills.length === 1 && Number(duration[1]) <= 50) {
        claims.push({ skillId: skills[0]!, months: Math.floor(Number(duration[1]) * 12) });
      }
    }
  }

  return [
    ...new Map(
      claims.sort((a, b) => a.months - b.months).map((claim) => [claim.skillId, claim]),
    ).values(),
  ].slice(0, 100);
}
