import { assertionAt } from './clauses.js';

export type EvidenceAction =
  'build' | 'operate' | 'optimize' | 'design' | 'deliver' | 'learn' | 'observe' | 'list' | 'other';

export type EvidenceOutcome =
  'latency' | 'throughput' | 'reliability' | 'consistency' | 'delivery' | 'unspecified';

export type EvidenceAssertion =
  | 'performed'
  | 'assisted'
  | 'observed'
  | 'learning'
  | 'negated'
  | 'listed'
  | 'reviewed'
  | 'contextual';

export interface CandidateEvidenceRef {
  blockId: string;
  lineIds: string[];
  source: 'employment' | 'project' | 'volunteering' | 'summary' | 'skills' | 'other';
  roleId?: string;
  action: EvidenceAction;
  objectId: string;
  outcome: EvidenceOutcome;
  assertion: EvidenceAssertion;
}

export function actionIn(text: string): EvidenceAction {
  if (/\b(?:learning|studying|exploring)\b/i.test(text)) {
    return 'learn';
  }

  if (/\b(?:observed|watched)\b/i.test(text)) {
    return 'observe';
  }

  if (
    /\b(?:reduced|reduce|cut|optimized|optimize|improved|improve|profiling|benchmarked)\b/i.test(
      text,
    )
  ) {
    return 'optimize';
  }

  if (/\b(?:architected|architecture|design|designed|defining|defined)\b/i.test(text)) {
    return 'design';
  }

  if (/\b(?:built|build|develop|developed|implemented|implement|implementing)\b/i.test(text)) {
    return 'build';
  }

  if (/\b(?:operated|operate|maintained|maintain|monitoring|monitor|troubleshoot)\b/i.test(text)) {
    return 'operate';
  }

  if (/\b(?:led|lead|owned|owning|delivered|delivery|launched)\b/i.test(text)) {
    return 'deliver';
  }

  return 'other';
}

export function outcomeIn(text: string): EvidenceOutcome {
  if (/\b(?:latency|response time|p99|p95)\b/i.test(text)) {
    return 'latency';
  }

  if (/\b(?:throughput|requests?\/(?:hour|second)|requests? per (?:hour|second))\b/i.test(text)) {
    return 'throughput';
  }

  if (/\b(?:failures?|reliable|reliability|recovery|retries|fault.toleran\w*)\b/i.test(text)) {
    return 'reliability';
  }

  if (/\b(?:consistency|idempotent|idempotency|conflicting writes)\b/i.test(text)) {
    return 'consistency';
  }

  if (/\b(?:delivery|rollout|release)\b/i.test(text)) {
    return 'delivery';
  }

  return 'unspecified';
}

export function evidenceClause(text: string, position: number): string {
  const before = text.slice(0, position);
  const prefix = before.split(/(?:[!?;\n]|\.(?=\s|$)|\bbut\b|\bhowever\b)/i).at(-1) ?? '';

  return (
    text.slice(position - prefix.length).split(/(?:[!?;\n]|\.(?=\s|$)|\bbut\b|\bhowever\b)/i)[0] ??
    ''
  );
}

export function assertionIn(text: string, position: number, listed = false): EvidenceAssertion {
  const state = assertionAt(text, position);

  if (state === 'negated') {
    return 'negated';
  }

  if (state === 'learning') {
    return 'learning';
  }

  if (state === 'contextual') {
    return 'contextual';
  }

  if (/\b(?:observed|watched)\b/i.test(evidenceClause(text, position))) {
    return 'observed';
  }

  if (state === 'ambiguous') {
    return 'assisted';
  }

  return listed ? 'listed' : 'performed';
}
