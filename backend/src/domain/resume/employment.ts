import type {
  EmployerIdentity,
  ResumeCategory,
  ResumeEmployment,
  ResumeLine,
  ResumeLocation,
} from './model.js';

const dateToken =
  '(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?\\s+(?:19|20)\\d{2}|(?:19|20)\\d{2}-(?:0[1-9]|1[0-2])|(?:0?[1-9]|1[0-2])/(?:19|20)\\d{2}|(?:19|20)\\d{2})';

const dateRange = new RegExp(
  `(${dateToken})\\s*(?:[-–—]|to)\\s*(${dateToken}|Present|Current|Now|Ongoing)`,
  'i',
);

const titlePattern =
  /\b(?:engineer|developer|scientist|researcher|manager|designer|analyst|recruiter|consultant|intern|director|specialist|architect|coordinator|associate|executive|officer|lead|trader)\b/i;

const employerAliases: Record<string, string[]> = {
  meta: ['Meta Platforms', 'Facebook'],
  google: ['Google LLC'],
  microsoft: ['Microsoft Corporation'],
  amazon: ['Amazon.com', 'Amazon Web Services', 'AWS'],
  x: ['Twitter', 'X'],
  'goldman-sachs': ['Goldman Sachs Group'],
  jpmorgan: ['JP Morgan', 'J.P. Morgan', 'JPMorgan Chase & Co.'],
};

function employerKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[,\.]/g, '')
    .replace(/\s+(?:inc|ltd|llc|limited|corporation|corp|plc)$/, '')
    .replace(/\s+/g, ' ');
}

export function recognizeEmployer(value: string, employers: EmployerIdentity[]) {
  const key = employerKey(value);

  return (
    employers.find((employer) =>
      [employer.name, ...(employerAliases[employer.slug] ?? [])].some(
        (alias) => employerKey(alias) === key,
      ),
    )?.slug ?? null
  );
}

export function roleCategory(title: string) {
  const rules: [RegExp, ResumeCategory][] = [
    [/\b(?:data scientist|machine learning|data engineer|analytics engineer)\b/i, 'data-ai'],
    [/\b(?:security|cybersecurity|IT support)\b/i, 'security-it'],
    [/\b(?:engineer|developer|architect)\b/i, 'engineering'],
    [/\b(?:product manager|product owner)\b/i, 'product'],
    [/\b(?:recruiter|recruiting|talent|human resources|HR|people)\b/i, 'people'],
    [/\b(?:sales|account executive|business development)\b/i, 'sales'],
    [/\b(?:designer|design)\b/i, 'design'],
    [/\b(?:marketing|communications)\b/i, 'marketing'],
    [/\b(?:financial|finance|accountant)\b/i, 'finance'],
    [/\b(?:trader|quantitative)\b/i, 'quant-trading'],
    [/\b(?:researcher|research scientist)\b/i, 'research'],
  ];

  return rules.find(([pattern]) => pattern.test(title))?.[1] ?? 'unclassified';
}

function parseHeader(header: string, employers: EmployerIdentity[]) {
  const parts = header
    .replace(/^(?:[-*•]\s*)/, '')
    .split(/\s*[|]\s*|\s+at\s+|\s+@\s+/i)
    .filter(Boolean);

  if (parts.length >= 2) {
    const firstIsRole = titlePattern.test(parts[0]!) && !recognizeEmployer(parts[0]!, employers);
    const employer = firstIsRole ? parts[1]! : parts[0]!;
    const title = firstIsRole ? parts[0]! : parts[1]!;

    return { employer: employer.trim(), title: title.trim() };
  }

  return null;
}

export function detectEmployment(
  lines: ResumeLine[],
  employers: EmployerIdentity[],
): ResumeEmployment[] {
  const result: ResumeEmployment[] = [];
  const usedHeaders = new Set<string>();

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;

    if (
      !['experience', 'projects', 'volunteering'].includes(line.section) ||
      line.heading ||
      !line.text.trim()
    ) {
      continue;
    }

    const range = dateRange.exec(line.text);

    const inline = range
      ? line.text
          .slice(0, range.index)
          .replace(/[|,\s]+$/, '')
          .trim()
      : line.text.trim();

    let header = parseHeader(inline, employers);
    let headerLine = line;

    if (range && !header) {
      const previous = lines
        .slice(Math.max(0, index - 3), index)
        .filter(
          (candidate) =>
            candidate.section === line.section &&
            !candidate.heading &&
            candidate.text.trim() &&
            !/^\s*[-*•]/.test(candidate.text) &&
            !dateRange.test(candidate.text),
        );

      const last = previous.at(-1);

      if (last) {
        header = parseHeader(last.text, employers);
        headerLine = last;

        if (!header && previous.length >= 2) {
          const first = previous.at(-2)!;

          const firstIsRole =
            titlePattern.test(first.text) && !recognizeEmployer(first.text, employers);

          if (titlePattern.test(first.text) || titlePattern.test(last.text)) {
            header = {
              employer: (firstIsRole ? last : first).text.trim(),
              title: (firstIsRole ? first : last).text.trim(),
            };

            headerLine = first;
          }
        }
      }
    }

    if (!header || !titlePattern.test(header.title)) {
      continue;
    }

    // A header followed by a date is handled together on the date iteration.
    if (
      !range &&
      lines
        .slice(index + 1, index + 3)
        .some((next) => next.section === line.section && dateRange.test(next.text))
    ) {
      continue;
    }

    if (usedHeaders.has(headerLine.id)) {
      continue;
    }

    usedHeaders.add(headerLine.id);

    result.push({
      id: `employment-${headerLine.number}`,
      ...header,
      recognizedCompany: recognizeEmployer(header.employer, employers),
      category: roleCategory(header.title),
      kind:
        line.section === 'projects'
          ? 'project'
          : line.section === 'volunteering'
            ? 'volunteering'
            : /\bintern\b/i.test(header.title)
              ? 'internship'
              : 'employment',
      relationship: /\bclient\b/i.test(header.employer) ? 'client' : 'unknown',
      start: range?.[1] ?? '',
      end: range?.[2] ?? '',
      status: range ? 'extracted' : 'uncertain',
      evidence: [...new Set([headerLine, line])].map((entry) => ({
        lineId: entry.id,
        excerpt: entry.text.trim(),
        rule: 'employment:header-and-dates',
      })),
    });
  }

  return result;
}

export function detectLocation(lines: ResumeLine[]): ResumeLocation {
  const header = lines.filter((line) => line.section === 'header');
  const explicit = header.find((line) => /^\s*(?:location|based in|address)\s*:/i.test(line.text));

  const cityCountry = header.find(
    (line) =>
      /^[\p{L} .'-]+,\s*[\p{L} .'-]+$/u.test(line.text.trim()) && !titlePattern.test(line.text),
  );

  const line = explicit ?? cityCountry;

  if (!line) {
    return { value: '', status: 'unknown', evidence: [] };
  }

  const value = line.text.replace(/^\s*(?:location|based in|address)\s*:/i, '').trim();

  return {
    value,
    status: value.includes(',') ? 'extracted' : 'uncertain',
    evidence: [{ lineId: line.id, excerpt: line.text.trim(), rule: 'location:header-only' }],
  };
}
