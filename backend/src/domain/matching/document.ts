export const jobDocumentVersion = 'job-document-3';

export type JobSectionRole =
  | 'overview'
  | 'role'
  | 'responsibilities'
  | 'qualifications'
  | 'benefits'
  | 'compensation'
  | 'application'
  | 'legal'
  | 'unknown';

export type RequirementImportance = 'required' | 'preferred' | 'contextual';

export interface JobBlock {
  id: string;
  kind: 'heading' | 'paragraph' | 'list-item';
  headingPath: string[];
  role: JobSectionRole;
  importance: RequirementImportance;
  start: number;
  end: number;
  line: number;
  text: string;
}

export interface JobDocument {
  version: string;
  text: string;
  blocks: JobBlock[];
  truncated: boolean;
}

export function jobHeading(
  value: string,
): { role: JobSectionRole; importance: RequirementImportance } | null {
  const text = value
    .trim()
    .replace(/[:：?]+$/, '')
    .trim();

  if (
    /^(?:preferred (?:qualifications|experience|skills)|nice[ -]to[ -]haves?|bonus(?: points)?|desirable)$/i.test(
      text,
    )
  ) {
    return { role: 'qualifications', importance: 'preferred' };
  }

  if (
    /^(?:minimum requirements|minimum qualifications|basic qualifications|required qualifications|key qualifications|requirements|your expertise|what you bring|skills you(?:'|’)ll need to bring|you (?:might |will )?thrive in this role if you|what you(?:'|’)ll need|what we need to see|what we(?:'|’)re looking for|what we look for|about you|qualifications|required skills|experience|education and training|our ideal .{1,100} will have)$/i.test(
      text,
    )
  ) {
    return { role: 'qualifications', importance: 'required' };
  }

  if (
    /^(?:key responsibilities|responsibilities|a typical day|what you(?:'|’)ll (?:do|achieve)|in this role,? you will|the impact you(?:'|’)ll have|as (?:a|an) .{1,100} you will)$/i.test(
      text,
    )
  ) {
    return { role: 'responsibilities', importance: 'contextual' };
  }

  if (
    /^(?:the community you will join|who we are|a note on AI|about us|about [\p{L}\d .&()-]{2,70}|our (?:company|mission)|company overview)$/iu.test(
      text,
    ) &&
    !/^about (?:the )?role$/i.test(text)
  ) {
    return { role: 'overview', importance: 'contextual' };
  }

  if (/^(?:benefits|perks|why join .{1,100})$/i.test(text)) {
    return { role: 'benefits', importance: 'contextual' };
  }

  if (/^(?:compensation|salary|salary range|annual salary range|pay range)$/i.test(text)) {
    return { role: 'compensation', importance: 'contextual' };
  }

  if (
    /^(?:how to apply|application process|interview process|accommodations?|accessibility)$/i.test(
      text,
    )
  ) {
    return { role: 'application', importance: 'contextual' };
  }

  if (
    /^(?:compliance|posting statement|our commitment to inclusion and belonging|our commitment to diversity and inclusion|equal (?:employment )?opportunity|diversity and inclusion)$/i.test(
      text,
    )
  ) {
    return { role: 'legal', importance: 'contextual' };
  }

  if (
    /^(?:key responsibilities|job details|job description|role overview|position summary|role details|about (?:the )?role|the role|our (?:team|stack)|job type|shift|primary location|additional locations|position of trust|work model for this role|additional information)$/i.test(
      text,
    )
  ) {
    return { role: 'role', importance: 'contextual' };
  }

  return null;
}

export function informationRole(text: string): JobSectionRole | null {
  if (
    /\b(?:during (?:the |our )?(?:hiring|interview|application) process|(?:your|a) recruiting partner|accommodation.{0,100}(?:disability|interview)|(?:recruiting|applicant) privacy policy|submit application|(?:we|employers?) (?:do not|never) charge|recruitment fees)\b/i.test(
      text,
    )
  ) {
    return 'application';
  }

  if (
    /\b(?:equal opportunity|equal employment|all qualified applicants|we do not discriminate|inclusive culture|our hiring practices|ethical hiring)\b/i.test(
      text,
    )
  ) {
    return 'legal';
  }

  if (
    /\b(?:compensation factors|salary range|compensation range|market range for this role|we do not have bonuses)\b/i.test(
      text,
    )
  ) {
    return 'compensation';
  }

  if (
    /\b(?:benefits (?:include|can include)|(?:health|dental|vision) insurance|paid (?:time off|leave))\b/i.test(
      text,
    )
  ) {
    return 'benefits';
  }

  return null;
}

export function readJobDocument(input: string): JobDocument {
  if (input.length > 200_000) {
    return { version: jobDocumentVersion, text: '', blocks: [], truncated: true };
  }

  // Recover known inline/fused labels for older stored text and plain-text boards.
  const text = input
    .replace(/\r\n?/g, '\n')
    .replace(
      /(^|\n)(\s*(?:Qualifications|Key Responsibilities|Minimum Qualifications|Preferred Qualifications|What we look for))(?=\d|[A-Z][a-z]|\s*[:：]\s*\S)/g,
      '$1$2\n',
    )
    .replace(
      /(^|\n)(\s*(?:Qualifications|Key Responsibilities|Minimum Qualifications|Preferred Qualifications|What we look for))\s*[:：]\s*/g,
      '$1$2\n',
    );

  const blocks: JobBlock[] = [];

  let section: { role: JobSectionRole; importance: RequirementImportance } = {
    role: 'unknown',
    importance: 'contextual',
  };

  let headingPath: string[] = [];
  let offset = 0;

  for (const [index, raw] of text.split('\n').entries()) {
    const start = offset;

    offset += raw.length + 1;

    if (!raw.trim()) {
      continue;
    }

    const heading = jobHeading(raw);

    if (heading) {
      section = heading;
      headingPath = [raw.trim()];
    }

    const role = heading ? section.role : (informationRole(raw) ?? section.role);

    const importance = ['application', 'benefits', 'compensation', 'legal', 'overview'].includes(
      role,
    )
      ? 'contextual'
      : section.importance;

    blocks.push({
      id: `job-block-${index + 1}`,
      kind: heading ? 'heading' : /^\s*[•*\-]/.test(raw) ? 'list-item' : 'paragraph',
      headingPath: [...headingPath],
      role,
      importance,
      start,
      end: start + raw.length,
      line: index + 1,
      text: raw,
    });

    if (blocks.length >= 2_000) {
      return { version: jobDocumentVersion, text, blocks, truncated: true };
    }
  }

  return { version: jobDocumentVersion, text, blocks, truncated: false };
}

export function isQualificationBlock(block: JobBlock) {
  return ![
    'application',
    'benefits',
    'compensation',
    'legal',
    'overview',
    'responsibilities',
    'role',
  ].includes(block.role);
}
