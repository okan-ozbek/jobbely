import { readFileSync } from 'node:fs';
import { z } from 'zod';
import type { Source } from '../../domain/model.js';
import { auditPlanSchema, assertAuditEvidence } from './model.js';

export function loadAuditPlans() {
  const plans = z
    .array(auditPlanSchema)
    .parse(
      JSON.parse(
        readFileSync(new URL('../../../config/source-audits.json', import.meta.url), 'utf8'),
      ),
    );

  if (new Set(plans.map((plan) => plan.companySlug)).size !== plans.length) {
    throw new Error('Duplicate company audit plans');
  }

  return plans;
}

export function requireVerifiedEvidence(sources: Source[], now = new Date()): void {
  const verifiedCompanies = new Set(
    sources
      .filter((source) => source.auditStatus === 'verified')
      .map((source) => source.companySlug),
  );

  if (!verifiedCompanies.size) {
    return;
  }

  const plans = loadAuditPlans();

  for (const companySlug of verifiedCompanies) {
    const plan = plans.find((entry) => entry.companySlug === companySlug);

    if (!plan) {
      throw new Error(`Missing audit plan: ${companySlug}`);
    }

    const input: unknown = JSON.parse(
      readFileSync(
        new URL(`../../../config/audit-evidence/${companySlug}.json`, import.meta.url),
        'utf8',
      ),
    );

    assertAuditEvidence(
      input,
      plan,
      sources.filter((source) => source.companySlug === companySlug),
      now,
    );
  }
}
