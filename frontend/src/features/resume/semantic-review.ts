import type { ConceptReview, JobMatchResponse } from '../../api/client.js';

export function coverageLabel(decision: JobMatchResponse['skills'][number]['decision']) {
  return {
    full: 'Full match',
    partial: 'Partial or uncertain',
    suggested: 'Possible unmentioned skill',
    none: 'No match',
  }[decision];
}

export function orderedSkillEvidence(skills: JobMatchResponse['comparison']['skills']) {
  const priority = { full: 0, partial: 1, suggested: 2, none: 3 };

  return skills.toSorted((left, right) => priority[left.decision] - priority[right.decision]);
}

export function reviewQuestions(skills: JobMatchResponse['comparison']['skills']) {
  const seen = new Set<string>();

  return skills
    .flatMap((skill) => {
      if (!skill.suggestion) {
        return [];
      }

      const key = `${skill.suggestion.id}:${skill.suggestion.facet}`;

      if (seen.has(key)) {
        return [];
      }

      seen.add(key);

      return [skill.suggestion];
    })
    .slice(0, 5);
}

export function mergeReview(reviews: ConceptReview[], review: ConceptReview) {
  return [
    ...reviews.filter((item) => item.id !== review.id || item.facet !== review.facet),
    review,
  ];
}
