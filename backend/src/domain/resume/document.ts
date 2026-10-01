import type { ResumeLine, ResumeSection } from './model.js';

const headings: Record<string, ResumeSection> = {
  summary: 'summary',
  profile: 'summary',
  'professional summary': 'summary',
  experience: 'experience',
  employment: 'experience',
  'work experience': 'experience',
  'professional experience': 'experience',
  'work history': 'experience',
  skills: 'skills',
  'technical skills': 'skills',
  technologies: 'skills',
  expertise: 'skills',
  competencies: 'skills',
  education: 'education',
  qualifications: 'education',
  certifications: 'education',
  projects: 'projects',
  'personal projects': 'projects',
  volunteering: 'volunteering',
  'volunteer experience': 'volunteering',
  interests: 'other',
  references: 'other',
};

export function readResumeText(input: string): { text: string; lines: ResumeLine[] } {
  // Offsets address this returned representation; we only normalize line endings.
  const text = input.replace(/\r\n?/g, '\n');
  let section: ResumeSection = 'header';
  let offset = 0;

  const lines = text.split('\n').map((value, index): ResumeLine => {
    const heading = headings[value.trim().toLowerCase().replace(/:$/, '')];

    if (heading) {
      section = heading;
    }

    const line = {
      id: `line-${index + 1}`,
      number: index + 1,
      start: offset,
      end: offset + value.length,
      text: value,
      section,
      heading: heading !== undefined,
    };

    offset += value.length + 1;

    return line;
  });

  return { text, lines };
}
