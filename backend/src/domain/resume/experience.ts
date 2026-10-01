import type { ExperienceRange, ResumeEmployment } from './model.js';

const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export interface DateBounds {
  earliest: number;
  latest: number;
}

export function dateBounds(value: string, end: boolean, analysisDate: string): DateBounds | null {
  const text = value.trim().toLowerCase();
  const now = Number(analysisDate.slice(0, 4)) * 12 + Number(analysisDate.slice(5, 7)) - 1;

  if (end && /^(present|current|now|ongoing)$/.test(text)) {
    return { earliest: now, latest: now };
  }

  const yearOnly = /^(19\d{2}|20\d{2})$/.exec(text);

  if (yearOnly) {
    const first = Number(yearOnly[1]) * 12;

    if (first > now) {
      return null;
    }

    return {
      earliest: Math.min(first + (end ? 1 : 0), now),
      latest: Math.min(first + (end ? 12 : 11), now),
    };
  }

  const iso = /^(19\d{2}|20\d{2})-(0[1-9]|1[0-2])$/.exec(text);
  const numeric = /^(0?[1-9]|1[0-2])\/(19\d{2}|20\d{2})$/.exec(text);
  const named = /^([a-z]+)\.?\s+(19\d{2}|20\d{2})$/.exec(text);

  const month = iso
    ? Number(iso[2]) - 1
    : numeric
      ? Number(numeric[1]) - 1
      : named
        ? months.indexOf(named[1]!.slice(0, 3))
        : -1;

  const year = Number(iso?.[1] ?? numeric?.[2] ?? named?.[2]);

  if (month < 0 || !year) {
    return null;
  }

  const index = year * 12 + month;

  if (index > now) {
    return null;
  }

  const boundary = Math.min(index + (end ? 1 : 0), now);

  return { earliest: boundary, latest: boundary };
}

function unionMonths(intervals: [number, number][]) {
  const ordered = intervals.filter(([start, end]) => end > start).sort((a, b) => a[0] - b[0]);
  let total = 0;
  let left = 0;
  let right = 0;

  for (const [start, end] of ordered) {
    if (start > right) {
      total += right - left;
      left = start;
      right = end;
    } else {
      right = Math.max(right, end);
    }
  }

  return total + right - left;
}

export function experienceRange(
  entries: ResumeEmployment[],
  analysisDate: string,
): ExperienceRange {
  const lower: [number, number][] = [];
  const upper: [number, number][] = [];
  let unknownEntries = 0;

  for (const entry of entries) {
    const start = dateBounds(entry.start, false, analysisDate);
    const end = dateBounds(entry.end, true, analysisDate);

    if (!start || !end || end.latest <= start.earliest) {
      unknownEntries++;
      continue;
    }

    lower.push([start.latest, end.earliest]);
    upper.push([start.earliest, end.latest]);
  }

  return { minimumMonths: unionMonths(lower), maximumMonths: unionMonths(upper), unknownEntries };
}

export function summarizeExperience(entries: ResumeEmployment[], analysisDate: string) {
  const professional = entries.filter((entry) => entry.kind === 'employment');

  const categories = [...new Set(professional.map((entry) => entry.category))].filter(
    (category) => category !== 'unclassified',
  );

  return {
    professional: experienceRange(professional, analysisDate),
    internships: experienceRange(
      entries.filter((entry) => entry.kind === 'internship'),
      analysisDate,
    ),
    relevant: categories.map((category) => ({
      category,
      duration: experienceRange(
        professional.filter((entry) => entry.category === category),
        analysisDate,
      ),
    })),
  };
}
