import type { EmployerIdentity, ResumeEmployment } from '../resume/model.js';
import { recognizeEmployer } from '../resume/employment.js';
import { summarizeExperience } from '../resume/experience.js';
import type { FeatureJob, MatchExplanation, MatchProfile } from './model.js';
import { projectSkills, skillMatch, relationsVersion } from './skill-relations.js';
import { degreeNames, degreeRank } from '../resume/qualifications.js';
import { assessmentCoverage, assessmentRatio } from './assessment-coverage.js';

export const scoringVersion = `score-6:${relationsVersion}`;

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
    assessmentCoverage: { assessed: 0, total: 0, percentage: null, limited: false },
    band: 'review',
    requiredGaps: 0,
    unresolvedRequirements:
      job.requirements.unparsed.filter((item) => item.importance !== 'contextual').length +
      job.requirements.constraints.filter(
        (item) => item.importance !== 'contextual' && !item.education,
      ).length,
    skills: [],
    experience: [],
    education: [],
    uncertainties: [],
    roleRelevancePoints: 0,
    location: 'Unknown: current location does not establish relocation or work authorization.',
    employerAdjustment: { points: 0, reasons: [], version: contextVersion },
  };

  let skillTotal = 0;
  let skillCredit = 0;
  let experienceCredit = 0;
  let experienceAssessed = 0;
  let contextCredit = 0;
  let contextTotal = 0;
  let unresolvedMandatory = job.requirements.truncated;

  if (job.requirements.truncated) {
    result.uncertainties.push(
      'Requirement extraction exceeded a resource limit. Review the full description.',
    );
  }

  for (const group of job.requirements.skills) {
    const weight = group.importance === 'required' ? 3 : 1;

    const alternatives = group.alternatives
      .map((alternative) => ({
        id: alternative.id,
        ...skillMatch(matches, alternative.id, alternative.facet, alternative.interpretation),
      }))
      .sort(
        (a, b) =>
          b.credit - a.credit ||
          Number(b.decision === 'partial') - Number(a.decision === 'partial') ||
          Number(b.decision === 'suggested') - Number(a.decision === 'suggested') ||
          a.id.localeCompare(b.id),
      );

    const best = alternatives[0]!;

    if (group.importance === 'contextual') {
      const role = job.requirements.blocks.find(
        (block) => block.id === group.evidence.blockId,
      )?.role;

      if (role !== 'responsibilities' && role !== 'role') {
        continue;
      }

      contextTotal++;
      contextCredit += best.credit;
    }

    if (
      group.importance !== 'contextual' &&
      (group.unresolvedAlternatives?.length ?? 0) > 0 &&
      best.credit < 1
    ) {
      result.unresolvedRequirements++;
      unresolvedMandatory ||= group.importance === 'required';

      result.uncertainties.push(
        `Alternative requirement needs review: ${group.unresolvedAlternatives!.join(' / ')}`,
      );
    }

    if (
      group.importance !== 'contextual' &&
      (!group.unresolvedAlternatives?.length || best.credit === 1)
    ) {
      skillTotal += weight;
      skillCredit += weight * best.credit;
    }

    result.skills.push({
      ...best,
      ...(group.id ? { requirementId: group.id } : {}),
      evidenceRefs:
        [...profile.skills, ...(profile.competencies ?? [])].find(
          (item) => item.id === best.sourceId,
        )?.evidenceRefs ?? [],
      unresolvedAlternatives: group.unresolvedAlternatives ?? [],
      logic: group.logic ?? (group.alternatives.length > 1 ? 'any-of' : 'single'),
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
          : (() => {
              const ids = requirement.alternativeIds?.length
                ? requirement.alternativeIds
                : requirement.skillId
                  ? [requirement.skillId]
                  : [];

              const group = job.requirements.skills.find(
                (item) => item.evidence.clauseId === requirement.evidence.clauseId,
              );

              const tenures = (profile.skillTenure ?? []).filter(
                (claim) =>
                  ids.includes(claim.skillId) &&
                  group?.alternatives.find((alternative) => alternative.id === claim.skillId)
                    ?.facet !== 'development' &&
                  skillMatch(matches, claim.skillId).credit === 1,
              );

              const months = Math.max(0, ...tenures.map((claim) => claim.months));

              return {
                minimumMonths: months,
                maximumMonths: months,
                unknownEntries:
                  ids.length > 0 &&
                  ids.every((id) => tenures.some((claim) => claim.skillId === id)) &&
                  !group?.unresolvedAlternatives?.length
                    ? 0
                    : 1,
              };
            })();

    const status =
      range.minimumMonths >= requirement.minimumMonths
        ? 'met'
        : range.maximumMonths < requirement.minimumMonths && range.unknownEntries === 0
          ? 'below'
          : 'uncertain';

    result.experience.push({
      minimumMonths: requirement.minimumMonths,
      ...(requirement.maximumMonths !== undefined
        ? { maximumMonths: requirement.maximumMonths }
        : {}),
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
      result.unresolvedRequirements++;

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
  let educationAssessed = 0;
  let educationCredit = 0;

  const educationRequirements = job.requirements.constraints.filter(
    (item) => item.education && item.importance !== 'contextual',
  );

  for (const requirement of educationRequirements) {
    const degree = requirement.education!;
    const claims = profile.education ?? [];
    const relatedFields = ['computer-science', 'engineering', 'mathematics', 'physics'];

    const matchesField = (field: string) =>
      degree.field === 'unknown' ||
      (degree.field !== 'other' &&
        (field === degree.field ||
          (degree.related &&
            relatedFields.includes(degree.field) &&
            relatedFields.includes(field))));

    const met = claims.some(
      (claim) =>
        claim.completion === 'completed' &&
        degreeRank[claim.level] >= degreeRank[degree.level] &&
        matchesField(claim.field),
    );

    const uncertain =
      !claims.length ||
      degree.field === 'other' ||
      claims.some(
        (claim) =>
          claim.completion === 'unknown' ||
          (claim.field === 'unknown' && degree.field !== 'unknown'),
      ) ||
      degree.alternativeExperience;

    const status = met ? 'met' : uncertain ? 'uncertain' : 'below';

    const reason = met
      ? 'A reviewed completed degree meets the level and recognized field requirement.'
      : status === 'below'
        ? 'The reviewed degree level, field or completion does not meet this requirement.'
        : 'The degree, subject or equivalent-experience alternative needs review. Missing evidence is not a verified absence.';

    result.education.push({
      name: degreeNames[degree.level],
      importance: requirement.importance,
      status,
      reason,
      excerpt: requirement.evidence.excerpt,
    });

    if (status === 'uncertain') {
      result.unresolvedRequirements++;
      unresolvedMandatory ||= requirement.importance === 'required';
      result.uncertainties.push(reason);
    } else {
      educationAssessed++;
      educationCredit += Number(met);
    }

    if (status === 'below' && requirement.importance === 'required') {
      result.requiredGaps++;
    }
  }

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
    if (
      constraint.kind !== 'location' &&
      !constraint.education &&
      constraint.importance !== 'contextual'
    ) {
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
    10 * locationAssessed +
    (educationRequirements.length ? (10 * educationAssessed) / educationRequirements.length : 0);

  const credit =
    (skillTotal ? (50 * skillCoverage * skillCredit) / skillTotal : 0) +
    (thresholds.length ? (20 * experienceCredit) / thresholds.length : 0) +
    15 * functionCredit +
    10 * locationCredit +
    (educationRequirements.length ? (10 * educationCredit) / educationRequirements.length : 0);

  const rolePoints = contextTotal ? Math.round((5 * contextCredit) / contextTotal) : 0;

  result.roleRelevancePoints = rolePoints;

  result.baseScore = assessedWeight
    ? Math.min(100, Math.round((100 * credit) / assessedWeight) + rolePoints)
    : 0;

  result.assessmentCoverage = assessmentCoverage(job.requirements, result);

  result.unresolvedRequirements =
    result.assessmentCoverage.total - result.assessmentCoverage.assessed;

  const mandatoryComparison =
    result.skills.some((item) => item.importance === 'required') ||
    thresholds.some((item) => item.importance === 'required') ||
    result.education.some((item) => item.importance === 'required');

  if (!mandatoryComparison) {
    result.uncertainties.push(
      'No recognized mandatory skills or experience comparisons. Review the description before treating this as a fit.',
    );
  }

  result.band =
    assessmentRatio(result.assessmentCoverage) < 0.6 || unresolvedMandatory || !mandatoryComparison
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

type RankedMatch = Pick<
  MatchExplanation,
  'band' | 'baseScore' | 'assessmentCoverage' | 'employerAdjustment'
> & { job: Pick<FeatureJob, 'id' | 'lastSeenAt'> };

export function compareMatches(left: RankedMatch, right: RankedMatch) {
  const bands = { strong: 0, possible: 1, exploratory: 2, review: 3 };
  const leftCoverage = assessmentRatio(left.assessmentCoverage);
  const rightCoverage = assessmentRatio(right.assessmentCoverage);

  return (
    bands[left.band] - bands[right.band] ||
    (right.baseScore + right.employerAdjustment.points) * rightCoverage -
      (left.baseScore + left.employerAdjustment.points) * leftCoverage ||
    rightCoverage - leftCoverage ||
    right.baseScore - left.baseScore ||
    right.job.lastSeenAt.localeCompare(left.job.lastSeenAt) ||
    left.job.id.localeCompare(right.job.id)
  );
}
