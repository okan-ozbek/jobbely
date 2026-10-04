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
  /\b(?:engineer|developer|scientist|researcher|manager|designer|analyst|recruiter|consultant|intern|director|specialist|architect|coordinator|associate|executive|officer|lead|trader|(?:co[ -]?)?founder|SWE|SDE|CTO)\b/i;

function headerText(value: string) {
  const text = value.trim();

  return (
    text.length > 0 &&
    text.length <= 140 &&
    text.split(/\s+/).length <= 16 &&
    !/[.!?]$/.test(text) &&
    !/^\s*[-*•]/.test(text) &&
    !/^(?:built|led|managed|mentored|implemented|improved|improving|developed|designed|delivered|refactored|architected|contributed|co-founded|drove|owned|created|worked|supported|presented|established|responsible)\b/i.test(
      text,
    )
  );
}

function roleTitle(value: string) {
  return headerText(value) && titlePattern.test(value);
}

export function hasEmploymentDates(line: ResumeLine) {
  return line.section === 'experience' && !line.heading && dateRange.test(line.text);
}

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
    [
      /\b(?:engineer|developer|architect|SWE|SDE|CTO|technical (?:co[ -]?)?founder|chief technology officer)\b/i,
      'engineering',
    ],
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

export function cleanRoleTitle(title: string) {
  return title
    .replace(/(?:\s*[,|–—-]\s*|\s*\()\b(?:full[ -]?time|part[ -]?time)\)?\s*$/i, '')
    .trim();
}

function parseHeader(header: string, employers: EmployerIdentity[]) {
  const parts = header
    .replace(/^(?:[-*•]\s*)/, '')
    .split(/\s*[|]\s*|\s+at\s+|\s+@\s+|\s+[-–—]\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    const firstIsRole =
      roleTitle(parts[0]!) && !roleTitle(parts[1]!) && !recognizeEmployer(parts[0]!, employers);

    const employer = firstIsRole ? parts[1]! : parts[0]!;
    const title = firstIsRole ? parts[0]! : parts[1]!;

    return headerText(employer) && roleTitle(title) ? { employer, title } : null;
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
    let evidenceLines = [line];

    if (range && !header && (!inline || roleTitle(inline))) {
      const previous = lines
        .slice(Math.max(0, index - 3), index)
        .filter(
          (candidate) =>
            candidate.section === line.section &&
            !candidate.heading &&
            candidate.text.trim() &&
            headerText(candidate.text) &&
            !dateRange.test(candidate.text),
        );

      const last = previous.at(-1);

      if (last) {
        header = parseHeader(last.text, employers);
        headerLine = last;
        evidenceLines = [last, line];

        if (!header && roleTitle(inline) && !roleTitle(last.text)) {
          header = { employer: last.text.trim(), title: inline };
        }

        if (!header && previous.length >= 2) {
          const first = previous.at(-2)!;

          const firstIsRole =
            roleTitle(first.text) &&
            !roleTitle(last.text) &&
            !recognizeEmployer(first.text, employers);

          if (roleTitle(first.text) || roleTitle(last.text)) {
            header = {
              employer: (firstIsRole ? last : first).text.trim(),
              title: (firstIsRole ? first : last).text.trim(),
            };

            headerLine = first;
            evidenceLines = [first, last, line];
          }
        }
      }
    }

    if (!header || !roleTitle(header.title)) {
      continue;
    }

    // A header followed by a date is handled together on the date iteration.
    if (
      !range &&
      lines.slice(index + 1, index + 3).some((next) => {
        const nextRange = dateRange.exec(next.text);

        return next.section === line.section && nextRange?.index === 0;
      })
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
      title: cleanRoleTitle(header.title),
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
      relationship: /\b(?:client|freelanc\w*|contract(?:or)?|self[ -]employed)\b/i.test(
        `${header.employer} ${header.title}`,
      )
        ? 'client'
        : line.section === 'experience'
          ? 'direct'
          : 'unknown',
      start: range?.[1] ?? '',
      end: range?.[2] ?? '',
      status: range ? 'extracted' : 'uncertain',
      evidence: [...new Set(evidenceLines)].map((entry) => ({
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
      /^[\p{L} .'-]+,\s*[\p{L} .'-]+$/u.test(line.text.split(/[|•]/)[0]!.trim()) &&
      !titlePattern.test(line.text),
  );

  const line = explicit ?? cityCountry;

  if (!line) {
    return { value: '', status: 'unknown', evidence: [] };
  }

  const value = line.text
    .split(/[|•]/)[0]!
    .replace(/^\s*(?:location|based in|address)\s*:/i, '')
    .trim();

  return {
    value,
    status: value.includes(',') ? 'extracted' : 'uncertain',
    evidence: [{ lineId: line.id, excerpt: line.text.trim(), rule: 'location:header-only' }],
  };
}
