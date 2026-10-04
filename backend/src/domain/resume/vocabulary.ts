import { actionIn, evidenceClause, outcomeIn, assertionIn } from '../semantics/propositions.js';
import type { CandidateEvidenceRef } from '../semantics/propositions.js';
import type { ResumeBlock, ResumeLine, ResumeSignal } from './model.js';
import { concepts, conceptsById, resolveConcept, registryVersion } from '../semantics/concepts.js';
import { assertionAt, clauseVersion } from '../semantics/clauses.js';
import { conceptsInText, recognizeConcepts } from '../semantics/recognize.js';

export const vocabularyVersion = `${registryVersion}:${clauseVersion}`;

export const supportedConcepts = concepts.map(({ id, name }) => ({ id, name }));

export const supportedSkills = concepts
  .filter((item) => item.kind !== 'competency')
  .map(({ id, name }) => ({ id, name }));

export const resolveSkill = resolveConcept;

export const skillsInText = conceptsInText;

export function skillMentions(text: string) {
  const mentions = recognizeConcepts(text.slice(0, 200_000));
  let end = 0;

  return mentions.filter((item) => {
    if (item.position < end) {
      return false;
    }

    end = item.position + item.length;

    return true;
  });
}

function detectSignals(lines: (ResumeLine | ResumeBlock)[], competency: boolean): ResumeSignal[] {
  const detected = new Map<string, ResumeSignal>();

  const priorities = {
    user_confirmed: 5,
    work_evidenced: 4,
    mentioned: 3,
    learning: 2,
    negated: 1,
  };

  for (const line of lines) {
    if (('heading' in line && line.heading) || line.section === 'header' || !line.text.trim()) {
      continue;
    }

    const mentions = recognizeConcepts(line.text, line.section === 'skills');

    // Keep the original action-backed competency recognizers while extending phrase coverage.
    if (competency && ['experience', 'projects', 'volunteering'].includes(line.section)) {
      for (const [id, name, pattern] of competencyPatterns) {
        const match = pattern.exec(line.text);

        if (match && !mentions.some((item) => item.id === id)) {
          mentions.push({
            id,
            name,
            position: match.index,
            length: match[0].length,
            facet: 'general',
            interpretation: 'interpreted',
            rule: `activity:${id}`,
          });
        }
      }
    }

    for (const mention of mentions) {
      if ((conceptsById.get(mention.id)?.kind === 'competency') !== competency) {
        continue;
      }

      if (
        competency &&
        (!['experience', 'projects', 'volunteering'].includes(line.section) ||
          (mention.rule.startsWith('alias:') &&
            !/\b(?:led|lead|leading|managed|managing|mentored|mentoring|owned|delivered|launched|presented|communicated|coordinated|collaborated|set|established|hired|conducted)\b/i.test(
              line.text,
            )))
      ) {
        continue;
      }

      const assertion = assertionAt(line.text, mention.position);

      const status: ResumeSignal['status'] =
        assertion === 'negated'
          ? 'negated'
          : assertion === 'learning'
            ? 'learning'
            : ['ambiguous', 'contextual'].includes(mention.interpretation)
              ? 'mentioned'
              : ['experience', 'projects', 'volunteering'].includes(line.section)
                ? 'work_evidenced'
                : 'mentioned';

      const evidence = {
        start: line.start + mention.position,
        end: line.start + mention.position + mention.length,
        lineId: 'lineIds' in line ? line.lineIds[0]! : line.id,
        ...('lineIds' in line
          ? {
              blockId: line.id,
              lineIds: line.lineIds,
              source: ('source' in line ? line.source : undefined) ?? sourceFor(line.section),
              ...(line.roleId ? { roleId: line.roleId } : {}),
            }
          : {}),
        excerpt: line.text.trim(),
        rule: `${mention.rule}:${status}`,
      };

      const previous = detected.get(mention.id);

      const signal = previous ?? {
        id: mention.id,
        name: mention.name,
        status,
        interpretation: mention.interpretation,
        facets: [],
        deniedFacets: [],
        uncertainFacets: [],
        evidence: [],
      };

      if (priorities[status] > priorities[signal.status]) {
        signal.status = status;
        signal.interpretation = mention.interpretation;
      }

      const key =
        status === 'negated'
          ? 'deniedFacets'
          : ['ambiguous', 'contextual'].includes(mention.interpretation) ||
              status === 'learning' ||
              status === 'mentioned'
            ? 'uncertainFacets'
            : 'facets';

      if (key !== 'uncertainFacets' || !signal.facets?.includes(mention.facet)) {
        signal[key] = [...new Set([...(signal[key] ?? []), mention.facet])];
      }

      if (key === 'facets') {
        signal.uncertainFacets =
          signal.uncertainFacets?.filter((facet) => facet !== mention.facet) ?? [];
      }

      if (key === 'deniedFacets') {
        signal.facets = signal.facets?.filter((facet) => facet !== mention.facet) ?? [];
      }

      if (
        signal.evidence.length < 5 &&
        !signal.evidence.some(
          (item) => item.lineId === evidence.lineId && item.rule === evidence.rule,
        )
      ) {
        signal.evidence.push(evidence);
      }

      // A stronger clause must retain its evidence even after the display cap.
      if (!signal.evidence.some((item) => item.rule.endsWith(`:${signal.status}`))) {
        signal.evidence[signal.evidence.length - 1] = evidence;
      }

      const ref: CandidateEvidenceRef = {
        blockId: line.id,
        lineIds: 'lineIds' in line ? line.lineIds : [line.id],
        source: ('source' in line ? line.source : undefined) ?? sourceFor(line.section),
        ...('roleId' in line && line.roleId ? { roleId: line.roleId } : {}),
        action:
          line.section === 'skills'
            ? 'list'
            : actionIn(evidenceClause(line.text, mention.position)),
        objectId: mention.id,
        outcome: outcomeIn(evidenceClause(line.text, mention.position)),
        assertion: assertionIn(
          line.text,
          mention.position,
          !['experience', 'projects', 'volunteering'].includes(line.section),
        ),
      };

      if (
        (signal.evidenceRefs?.length ?? 0) < 5 &&
        !signal.evidenceRefs?.some((item) => item.blockId === ref.blockId)
      ) {
        signal.evidenceRefs = [...(signal.evidenceRefs ?? []), ref];
      }

      if (
        signal.evidenceRefs?.length === 5 &&
        ['work_evidenced', 'negated', 'learning'].includes(status) &&
        !signal.evidenceRefs.some((item) => item.assertion === ref.assertion)
      ) {
        signal.evidenceRefs[4] = ref;
      }

      detected.set(mention.id, signal);
    }
  }

  return [...detected.values()];
}

export function detectSkills(lines: (ResumeLine | ResumeBlock)[]) {
  return detectSignals(lines, false);
}

export function detectCompetencies(lines: (ResumeLine | ResumeBlock)[]) {
  return detectSignals(lines, true);
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

function sourceFor(section: ResumeLine['section']): CandidateEvidenceRef['source'] {
  return section === 'experience'
    ? 'employment'
    : section === 'projects'
      ? 'project'
      : section === 'volunteering'
        ? 'volunteering'
        : section === 'summary'
          ? 'summary'
          : section === 'skills'
            ? 'skills'
            : 'other';
}
