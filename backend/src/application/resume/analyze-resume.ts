import { resumeBlocks } from '../../domain/resume/blocks.js';
import { detectEducation, detectSkillTenure } from '../../domain/resume/qualifications.js';
import { conceptsById, defaultFacet } from '../../domain/semantics/concepts.js';
import type { SignalReview } from '../../domain/semantics/model.js';
import { readResumeText } from '../../domain/resume/document.js';
import {
  detectEmployment,
  detectLocation,
  hasEmploymentDates,
  recognizeEmployer,
} from '../../domain/resume/employment.js';
import { dateBounds, summarizeExperience } from '../../domain/resume/experience.js';
import type {
  EmployerIdentity,
  ResumeAnalysis,
  ResumeEmployment,
  ResumeInput,
  ResumeSignal,
} from '../../domain/resume/model.js';
import {
  detectCompetencies,
  detectSkills,
  resolveSkill,
  supportedSkills,
  vocabularyVersion,
} from '../../domain/resume/vocabulary.js';

export class ResumeInputError extends Error {}

function correctedSignals(
  signals: ResumeSignal[],
  additions: string[] = [],
  removals: string[] = [],
) {
  const result = signals.filter((signal) => !removals.includes(signal.id));

  for (const name of additions) {
    const trimmed = name.trim();

    if (!trimmed) {
      continue;
    }

    const known = resolveSkill(trimmed);

    const existing = result.find(
      (signal) => signal.id === known?.id || signal.name.toLowerCase() === trimmed.toLowerCase(),
    );

    if (existing) {
      existing.status = 'user_confirmed';
      existing.facets = existing.facets?.length ? existing.facets : [defaultFacet(existing.id)];
      existing.deniedFacets = [];
      existing.uncertainFacets = [];
      existing.interpretation = 'explicit';
    } else {
      result.push({
        id: known?.id ?? `custom:${trimmed.toLowerCase()}`,
        name: known?.name ?? trimmed,
        status: 'user_confirmed',
        facets: [defaultFacet(known?.id ?? '')],
        interpretation: 'explicit',
        evidence: [],
      });
    }
  }

  return result;
}

function reviewedSignals(signals: ResumeSignal[], reviews: SignalReview[], competency: boolean) {
  const result = [...signals];

  for (const review of reviews) {
    const concept = conceptsById.get(review.id);

    if (!concept || !concept.facets.includes(review.facet)) {
      throw new ResumeInputError('Review a supported concept and facet.');
    }

    if ((concept.kind === 'competency') !== competency) {
      continue;
    }

    let signal = result.find((item) => item.id === review.id);

    if (!signal) {
      signal = {
        id: concept.id,
        name: concept.name,
        status: 'mentioned',
        facets: [],
        evidence: [],
      };

      result.push(signal);
    }

    signal.facets = (signal.facets ?? []).filter((item) => item !== review.facet);
    signal.deniedFacets = (signal.deniedFacets ?? []).filter((item) => item !== review.facet);
    signal.uncertainFacets = (signal.uncertainFacets ?? []).filter((item) => item !== review.facet);

    if (review.answer === 'confirmed') {
      signal.facets.push(review.facet);
    }

    if (review.answer === 'denied') {
      signal.deniedFacets.push(review.facet);
    }

    if (review.answer === 'unsure') {
      signal.uncertainFacets.push(review.facet);
    }

    signal.status = signal.facets.length
      ? 'user_confirmed'
      : review.answer === 'denied'
        ? 'negated'
        : 'mentioned';

    signal.interpretation =
      review.answer === 'unsure' && !signal.facets.length ? 'ambiguous' : 'explicit';
  }

  return result;
}

export class AnalyzeResume {
  constructor(
    private readonly employers: EmployerIdentity[],
    private readonly clock: () => Date = () => new Date(),
  ) {}

  execute(input: ResumeInput): ResumeAnalysis {
    if (
      !input.text.trim() ||
      input.text.length > 100_000 ||
      input.text.split(/\r\n?|\n/).length > 2_000
    ) {
      throw new ResumeInputError(
        'Paste between 1 and 100,000 characters, with at most 2,000 lines.',
      );
    }

    if (input.text.split(/\r\n?|\n/).some((line) => line.length > 2_000)) {
      throw new ResumeInputError(
        'Each line must be at most 2,000 characters. Add line breaks and try again.',
      );
    }

    const today = this.clock().toISOString().slice(0, 10);
    const analysisDate = input.analysisDate ?? today;

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(analysisDate) ||
      !Number.isFinite(Date.parse(analysisDate)) ||
      new Date(analysisDate).toISOString().slice(0, 10) !== analysisDate ||
      analysisDate > today ||
      analysisDate < '1900-01-01'
    ) {
      throw new ResumeInputError('The analysis date must be a valid date no later than today.');
    }

    const document = readResumeText(input.text);
    let employment = detectEmployment(document.lines, this.employers);
    const extractedEmployment = [...employment];

    const employmentHeaderLines = new Set(
      employment.flatMap((entry) => entry.evidence.map((item) => item.lineId)),
    );

    if (employment.length > 100) {
      throw new ResumeInputError('At most 100 employment entries are supported.');
    }

    const corrections = input.corrections ?? {};
    const reviews = corrections.signalReviews ?? [];

    if (
      reviews.length > 100 ||
      new Set(reviews.map((item) => `${item.id}:${item.facet}`)).size !== reviews.length
    ) {
      throw new ResumeInputError('Use at most 100 unique concept/facet reviews.');
    }

    const seen = new Set<string>();

    for (const correction of corrections.employment ?? []) {
      if (seen.has(correction.id)) {
        throw new ResumeInputError('Each employment correction must have a unique ID.');
      }

      seen.add(correction.id);

      const existing = employment.find((entry) => entry.id === correction.id);

      if (!existing && !correction.id.startsWith('manual-')) {
        throw new ResumeInputError('An employment correction refers to an unknown entry.');
      }

      if (correction.removed) {
        employment = employment.filter((entry) => entry.id !== correction.id);
        continue;
      }

      const fields = { ...correction };

      delete fields.removed;

      const entry: ResumeEmployment = {
        employer: '',
        title: '',
        category: 'unclassified',
        kind: 'employment',
        relationship: 'direct',
        start: '',
        end: '',
        recognizedCompany: null,
        evidence: [],
        ...existing,
        ...fields,
        status: 'user_confirmed',
      };

      entry.recognizedCompany = recognizeEmployer(entry.employer, this.employers);

      employment = existing
        ? employment.map((item) => (item.id === entry.id ? entry : item))
        : [...employment, entry];
    }

    const location = detectLocation(document.lines);

    if (corrections.location !== undefined) {
      location.value = corrections.location.trim();
      location.status = 'user_confirmed';
    }

    const warnings: string[] = [];

    const unmatchedDateLines = document.lines.filter(
      (line) => hasEmploymentDates(line) && !employmentHeaderLines.has(line.id),
    );

    if (unmatchedDateLines.length) {
      warnings.push(
        `${unmatchedDateLines.length} dated experience line(s) could not be associated with a role. Review the reading preview and add missing roles; the experience total may be incomplete.`,
      );
    }

    if (!document.lines.some((line) => line.heading)) {
      warnings.push(
        'No standard section headings found. Add Experience and Skills headings, or enter missing roles manually.',
      );
    }

    if (!employment.length) {
      warnings.push(
        'No employment blocks recognized. Use “Role | Employer” or “Employer – Role” with a date range, or add a role below.',
      );
    }

    for (const entry of employment) {
      const start = dateBounds(entry.start, false, analysisDate);
      const end = dateBounds(entry.end, true, analysisDate);

      if (!start || !end || end.latest <= start.earliest) {
        warnings.push(
          `Review dates for ${entry.title || 'untitled role'}: missing, unsupported, future or reversed dates are excluded from duration totals.`,
        );

        if (entry.status !== 'user_confirmed') {
          entry.status = 'uncertain';
        }
      } else if (start.earliest !== start.latest || end.earliest !== end.latest) {
        warnings.push(
          `Year-only dates for ${entry.title || 'untitled role'} produce a duration range.`,
        );
      }
    }

    const blocks = resumeBlocks(document.lines, extractedEmployment);

    for (const block of blocks) {
      const role = employment.find((entry) => entry.id === block.roleId);

      if (block.roleId && !role) {
        delete block.roleId;
      }

      if (role?.kind === 'project' || role?.kind === 'volunteering') {
        block.source = role.kind;
      }
    }

    return {
      version: 'text-5',
      vocabularyVersion,
      analysisDate,
      document: { ...document, blocks },
      skills: reviewedSignals(
        correctedSignals(
          detectSkills(blocks.filter((block) => block.kind !== 'role' && block.kind !== 'heading')),
          corrections.addSkills,
          corrections.removeSkills,
        ),
        reviews,
        false,
      ),
      competencies: reviewedSignals(
        correctedSignals(
          detectCompetencies(
            blocks.filter((block) => block.kind !== 'role' && block.kind !== 'heading'),
          ),
          corrections.addCompetencies,
          corrections.removeCompetencies,
        ),
        reviews,
        true,
      ),
      employment,
      location,
      education: corrections.education ?? detectEducation(document.lines, analysisDate),
      skillTenure: corrections.skillTenure ?? detectSkillTenure(document.lines),
      experience: summarizeExperience(employment, analysisDate),
      warnings,
      supportedSkills,
    };
  }
}
