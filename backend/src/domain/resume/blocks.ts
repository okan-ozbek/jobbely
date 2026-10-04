import type { ResumeBlock, ResumeEmployment, ResumeLine } from './model.js';

export function resumeBlocks(lines: ResumeLine[], employment: ResumeEmployment[]): ResumeBlock[] {
  const blocks: ResumeBlock[] = [];

  const headers = new Map(
    employment.flatMap((role) => role.evidence.map((item) => [item.lineId, role.id] as const)),
  );

  let roleId: string | undefined;

  for (const line of lines) {
    const headerRole = headers.get(line.id);

    if (line.heading) {
      roleId = undefined;
    }

    if (headerRole) {
      roleId = headerRole;
    }

    if (!line.text.trim()) {
      continue;
    }

    const kind = line.heading
      ? 'heading'
      : headerRole
        ? 'role'
        : /^\s*[•*\-]\s/.test(line.text)
          ? 'bullet'
          : 'paragraph';

    const previous = blocks.at(-1);

    const continues =
      previous &&
      !line.heading &&
      !headerRole &&
      kind !== 'bullet' &&
      previous.kind !== 'heading' &&
      previous.kind !== 'role' &&
      previous.section === line.section &&
      previous.end + 1 === line.start &&
      previous.text.length + line.text.length < 8_000 &&
      previous.lineIds.length < 20 &&
      (previous.kind === 'bullet' ||
        /^[a-z]/.test(line.text.trim()) ||
        /(?:[,;:]|\b(?:distributed|service-oriented|high|fault))\s*$/i.test(previous.text)) &&
      !/[.!?]\s*$/.test(previous.text) &&
      !/^\s*[\p{L} .'-]+,\s*[\p{L} .'-]+$/u.test(line.text) &&
      !/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\b|\b\d{4}\s*[-–]/i.test(
        line.text,
      );

    if (continues) {
      const blockStart = previous.text.length + 1;

      previous.text += ` ${line.text}`;
      previous.end = line.end;
      previous.lineIds.push(line.id);

      previous.sourceSpans.push({
        start: line.start,
        end: line.end,
        blockStart,
        blockEnd: previous.text.length,
      });

      continue;
    }

    blocks.push({
      id: `resume-block-${line.number}`,
      lineIds: [line.id],
      start: line.start,
      end: line.end,
      text: line.text,
      section: line.section,
      kind,
      ...(roleId && line.section === 'experience' ? { roleId } : {}),
      sourceSpans: [
        { start: line.start, end: line.end, blockStart: 0, blockEnd: line.text.length },
      ],
    });
  }

  return blocks;
}
