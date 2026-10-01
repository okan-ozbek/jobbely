import type { EmployerIdentity, ResumeEmployment } from '../resume/model.js';
import { recognizeEmployer } from '../resume/employment.js';
import { summarizeExperience } from '../resume/experience.js';
import type { FeatureJob, MatchExplanation, MatchProfile } from './model.js';
import { projectSkills, skillMatch, relationsVersion } from './skill-relations.js';

export const scoringVersion = `score-2:${relationsVersion}`;

export const contextVersion = 'context-1';

export function prepareCandidate(profile: MatchProfile, employers: EmployerIdentity[]) {
  const employment: ResumeEmployment[] = profile.employment.map((entry, index) => ({
    ...entry,
    id: String(index),
    title: '',
    recognizedCompany: recognizeEmployer(entry.employer, employers),
    status: 'user_confirmed',
    evidence: [],
  }));

  const contextKeys = new Set<string>();

  for (const entry of employment) {
    if (
      entry.kind === 'employment' &&
      entry.relationship === 'direct' &&
      entry.recognizedCompany &&
      summarizeExperience([entry], profile.analysisDate).professional.minimumMonths > 0
    ) {
      contextKeys.add(`${entry.recognizedCompany}:${entry.category}`);
    }
  }

  return {
    durations: summarizeExperience(employment, profile.analysisDate),
    matches: projectSkills([...profile.skills, ...(profile.competencies ?? [])]),
    functions: new Set<string>(
      employment
        .filter((entry) => entry.kind === 'employment' && entry.category !== 'unclassified')
        .map((entry) => entry.category),
    ),
    contextKeys,
  };
}

// Context reflects direct employment in the target employer's function, not fame.
// Unknown employers receive the identical neutral baseline. No prestige ranking.
export function scoreJob(
  job: FeatureJob,
  profile: MatchProfile,
  employers: EmployerIdentity[],
  context: boolean,
  prepared = prepareCandidate(profile, employers),
): MatchExplanation {
  const { durations, matches, functions } = prepared;

  const result: MatchExplanation = {
    job,
    baseScore: 0,
    completeness: 0,
    band: 'review',
    requiredGaps: 0,
    skills: [],
    experience: [],
    uncertainties: [],
    location: 'Unknown: current location does not establish relocation or work authorization.',
    employerAdjustment: { points: 0, reasons: [], version: contextVersion },
  };

  let skillTotal = 0;
  let skillCredit = 0;
  let experienceCredit = 0;
  let experienceAssessed = 0;
  let unresolvedMandatory = job.requirements.truncated;

  if (job.requirements.truncated) {
    result.uncertainties.push(
      'Requirement extraction exceeded a resource limit. Review the full description.',
    );
  }

  for (const group of job.requirements.skills) {
    if (group.importance === 'contextual') {
      continue;
    }

    const weight = group.importance === 'required' ? 3 : 1;

    const alternatives = group.alternatives
      .map((alternative) => ({ id: alternative.id, ...skillMatch(matches, alternative.id) }))
      .sort(
        (a, b) =>
          b.credit - a.credit ||
          Number(b.confidence === 'orange') - Number(a.confidence === 'orange') ||
          a.id.localeCompare(b.id),
      );

    const best = alternatives[0]!;

    skillTotal += weight;
    skillCredit += weight * best.credit;

    result.skills.push({
      confidence: best.confidence,
      credit: best.credit,
      sourceId: best.sourceId,
      sourceName: best.sourceName,
      path: best.path,
      reason: best.reason,
      names: group.alternatives.map((item) => item.name),
      importance: group.importance,
      status: best.credit === 1 ? 'matched' : best.credit > 0 ? 'claim_only' : 'not_evidenced',
      matchedId: best.credit ? best.id : null,
      excerpt: group.evidence.excerpt,
    });

    if (group.importance === 'required' && best.credit < 1) {
      result.requiredGaps++;
    }
  }

  const thresholds = job.requirements.experience.filter((item) => item.importance !== 'contextual');

  for (const requirement of thresholds) {
    const range =
      requirement.scope === 'professional'
        ? durations.professional
        : requirement.scope === 'function'
          ? (durations.relevant.find((item) => item.category === job.requirements.category)
              ?.duration ?? { minimumMonths: 0, maximumMonths: 0, unknownEntries: 0 })
          : { minimumMonths: 0, maximumMonths: 0, unknownEntries: 1 };

    const status =
      range.minimumMonths >= requirement.minimumMonths
        ? 'met'
        : range.maximumMonths < requirement.minimumMonths && range.unknownEntries === 0
          ? 'below'
          : 'uncertain';

    result.experience.push({
      minimumMonths: requirement.minimumMonths,
      importance: requirement.importance,
      candidateMinimumMonths: range.minimumMonths,
      candidateMaximumMonths: range.maximumMonths,
      status,
      scope: requirement.scope,
      excerpt: requirement.evidence.excerpt,
    });

    if (status !== 'uncertain') {
      experienceAssessed++;

      experienceCredit +=
        status === 'met'
          ? 1
          : Math.min(1, range.maximumMonths / Math.max(1, requirement.minimumMonths));
    } else {
      result.uncertainties.push(
        'Experience cannot be resolved from the reviewed dates or skill-specific tenure.',
      );

      unresolvedMandatory ||= requirement.importance === 'required';
    }

    if (status === 'below' && requirement.importance === 'required') {
      result.requiredGaps++;
    }
  }

  let locationAssessed = 0;
  let locationCredit = 0;

  const locationConstraints = job.requirements.constraints.filter(
    (item) => item.kind === 'location' && item.importance === 'required',
  );

  const reliableLocation =
    ['extracted', 'user_confirmed'].includes(profile.location.status) &&
    profile.location.value.trim().length > 0;

  const normalizeLocation = (value: string) =>
    value
      .toLowerCase()
      .split(',')
      .map((part) => part.trim())
      .join(',');

  const sameLocation =
    reliableLocation &&
    job.requirements.locations.some(
      (location) => normalizeLocation(location) === normalizeLocation(profile.location.value),
    );

  if (sameLocation && locationConstraints.length === 0) {
    locationAssessed = 1;
    locationCredit = 1;

    result.location =
      'Current location overlaps a listed location; authorization still needs checking.';
  } else {
    result.uncertainties.push(
      'Location or relocation eligibility needs confirmation. Remote does not mean worldwide.',
    );

    unresolvedMandatory ||= locationConstraints.length > 0;
  }

  for (const constraint of job.requirements.constraints) {
    if (constraint.kind !== 'location' && constraint.importance !== 'contextual') {
      result.uncertainties.push(`${constraint.kind}: ${constraint.evidence.excerpt}`);
      unresolvedMandatory ||= constraint.importance === 'required';
    }
  }

  for (const statement of job.requirements.unparsed) {
    result.uncertainties.push(
      `Unparsed ${statement.importance} statement: ${statement.evidence.excerpt}`,
    );

    unresolvedMandatory ||= statement.importance === 'required';
  }

  const functionAssessed = functions.size > 0 ? 1 : 0;
  const functionCredit = functions.has(job.requirements.category) ? 1 : 0;

  const unknownWeight = job.requirements.unparsed.reduce(
    (total, item) => total + (item.importance === 'required' ? 3 : 1),
    0,
  );

  const skillCoverage = skillTotal ? skillTotal / (skillTotal + unknownWeight) : 0;

  const assessedWeight =
    50 * skillCoverage +
    (thresholds.length ? (20 * experienceAssessed) / thresholds.length : 0) +
    15 * functionAssessed +
    10 * locationAssessed;

  const credit =
    (skillTotal ? (50 * skillCoverage * skillCredit) / skillTotal : 0) +
    (thresholds.length ? (20 * experienceCredit) / thresholds.length : 0) +
    15 * functionCredit +
    10 * locationCredit;

  result.baseScore = assessedWeight ? Math.round((100 * credit) / assessedWeight) : 0;
  result.completeness = Math.round(assessedWeight);

  const mandatoryComparison =
    result.skills.some((item) => item.importance === 'required') ||
    thresholds.some((item) => item.importance === 'required');

  if (!mandatoryComparison) {
    result.uncertainties.push(
      'No recognized mandatory skills or experience comparisons. Review the description before treating this as a fit.',
    );
  }

  result.band =
    assessedWeight < 60 || unresolvedMandatory || !mandatoryComparison
      ? 'review'
      : result.requiredGaps
        ? 'exploratory'
        : result.baseScore >= 80
          ? 'strong'
          : result.baseScore >= 60
            ? 'possible'
            : 'exploratory';

  if (context && result.requiredGaps === 0 && result.band !== 'review') {
    if (prepared.contextKeys.has(`${job.companySlug}:${job.requirements.category}`)) {
      result.employerAdjustment = {
        points: 3,
        reasons: [
          'Reviewed direct employment in this employer and function; a capped continuity adjustment, not verified proficiency.',
        ],
        version: contextVersion,
      };
    }
  }

  return result;
}

export function compareMatches(left: MatchExplanation, right: MatchExplanation) {
  const bands = { strong: 0, possible: 1, exploratory: 2, review: 3 };

  return (
    bands[left.band] - bands[right.band] ||
    right.baseScore +
      right.employerAdjustment.points -
      left.baseScore -
      left.employerAdjustment.points ||
    right.completeness - left.completeness ||
    right.job.lastSeenAt.localeCompare(left.job.lastSeenAt) ||
    left.job.id.localeCompare(right.job.id)
  );
}
