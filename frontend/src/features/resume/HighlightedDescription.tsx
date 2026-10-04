import { createElement, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { JobMatchResponse, ResumeAnalysis } from '../../api/client.js';
import { highlightSegments, mapHtmlHighlights } from './highlights.js';
import { coverageLabel } from './semantic-review.js';

type Annotation = JobMatchResponse['skills'][number];

const tags = new Set([
  'p',
  'br',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'b',
  'i',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'a',
  'div',
  'span',
]);

const blocked = new Set(['script', 'style', 'iframe', 'object', 'template']);

export function HighlightedDescription({
  html,
  data,
  analysis,
  highlight,
}: {
  html: string;
  data: JobMatchResponse | null;
  analysis: ResumeAnalysis | null;
  highlight: boolean;
}) {
  const popupId = useId();

  const [active, setActive] = useState<{
    annotation: Annotation;
    rect: DOMRect;
    data: JobMatchResponse;
  } | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popup = useRef<HTMLDivElement>(null);
  const pinned = useRef(false);

  const prepared = useMemo(() => {
    const document = new DOMParser().parseFromString(html, 'text/html');
    const nodes: Text[] = [];

    const collect = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        nodes.push(node as Text);
      } else if (!blocked.has(node.nodeName.toLowerCase())) {
        node.childNodes.forEach(collect);
      }
    };

    collect(document.body);

    const indices = new Map(nodes.map((node, index) => [node, index]));

    const spans = mapHtmlHighlights(
      nodes.map((node) => node.data),
      data?.descriptionText ?? '',
      highlight ? (data?.skills ?? []) : [],
    );

    return { root: document.body, indices, spans };
  }, [html, data, highlight]);

  const keepOpen = () => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
  };

  const closeSoon = () => {
    keepOpen();

    if (!pinned.current) {
      timer.current = setTimeout(() => setActive(null), 180);
    }
  };

  const closeOnBlur = (target: EventTarget | null) => {
    if (target instanceof Node && !popup.current?.contains(target)) {
      pinned.current = false;
    }

    closeSoon();
  };

  useEffect(() => {
    const dismiss = (event: Event) => {
      if (event.target instanceof Node && popup.current?.contains(event.target)) {
        return;
      }

      if (
        event.type === 'pointerdown' &&
        event.target instanceof Element &&
        event.target.closest('.skill-highlight')
      ) {
        return;
      }

      pinned.current = false;
      setActive(null);
    };

    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActive(null);
      }
    };

    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    window.addEventListener('keydown', escape);
    window.addEventListener('pointerdown', dismiss);

    return () => {
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('keydown', escape);
      window.removeEventListener('pointerdown', dismiss);

      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  const visible = highlight && active?.data === data ? active : null;

  const render = (node: Node, key: number): ReactNode => {
    if (node.nodeType === Node.TEXT_NODE) {
      const index = prepared.indices.get(node as Text)!;

      return highlightSegments(node.textContent ?? '', prepared.spans[index] ?? []).map(
        (segment, segmentIndex) => {
          const annotation = segment.span
            ? { ...segment.span, position: segment.span.sourcePosition }
            : undefined;

          if (!annotation || !data) {
            return segment.text;
          }

          const open = (element: HTMLElement, pin = false) => {
            keepOpen();
            pinned.current = pin;
            setActive({ annotation, rect: element.getBoundingClientRect(), data });
          };

          const expanded =
            visible?.annotation.position === annotation.position &&
            visible.annotation.id === annotation.id;

          return (
            <mark
              key={segmentIndex}
              className={`keyword-${annotation.confidence} skill-highlight`}
              tabIndex={0}
              role="button"
              aria-haspopup="dialog"
              aria-label={`${annotation.name}: ${coverageLabel(annotation.decision)}. Show match context.`}
              aria-expanded={expanded}
              aria-controls={expanded ? popupId : undefined}
              onMouseEnter={(event) => open(event.currentTarget)}
              onMouseLeave={closeSoon}
              onFocus={(event) => open(event.currentTarget)}
              onBlur={(event) => closeOnBlur(event.relatedTarget)}
              onClick={(event) => {
                event.preventDefault();
                open(event.currentTarget, true);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  open(event.currentTarget, true);
                }
              }}
            >
              {segment.text}
            </mark>
          );
        },
      );
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const tag = node.nodeName.toLowerCase();

    if (blocked.has(tag)) {
      return null;
    }

    const children = Array.from(node.childNodes).map(render);

    if (!tags.has(tag)) {
      return children;
    }

    const attrs: { key: number; href?: string; title?: string; target?: string; rel?: string } = {
      key,
    };

    if (tag === 'a') {
      const link = (node as Element).getAttribute('href');

      if (link && /^(?:https?:\/\/|mailto:)/i.test(link)) {
        attrs.href = link;
        attrs.target = '_blank';
        attrs.rel = 'noopener noreferrer';
      }

      const title = (node as Element).getAttribute('title');

      if (title) {
        attrs.title = title;
      }
    }

    return createElement(tag, attrs, ...(tag === 'br' ? [] : children));
  };

  const context =
    visible &&
    data?.comparison.skills.find(
      (skill) =>
        skill.targetId === visible.annotation.targetId && skill.facet === visible.annotation.facet,
    );

  const above =
    visible &&
    window.innerHeight - visible.rect.bottom < visible.rect.top &&
    window.innerHeight - visible.rect.bottom < 280;

  const width = Math.min(360, window.innerWidth - 32);

  const source = [...(analysis?.skills ?? []), ...(analysis?.competencies ?? [])].find(
    (signal) => signal.id === visible?.annotation.sourceId,
  );

  const refs =
    context && context.sourceId === visible?.annotation.sourceId
      ? context.evidenceRefs
      : (source?.evidenceRefs ?? []);

  const excerpts = refs.flatMap((ref) => {
    const block = analysis?.document.blocks.find((item) => item.id === ref.blockId);

    return block ? [block.text] : [];
  });

  return (
    <>
      <article className="description original-description">
        {Array.from(prepared.root.childNodes).map(render)}
      </article>
      {visible &&
        createPortal(
          <div
            id={popupId}
            ref={popup}
            role="dialog"
            aria-label={`${visible.annotation.name} match context`}
            className="skill-context"
            style={{
              width,
              left: Math.max(16, Math.min(window.innerWidth - width - 16, visible.rect.left)),
              ...(above
                ? {
                    bottom: window.innerHeight - visible.rect.top + 8,
                    maxHeight: visible.rect.top - 24,
                  }
                : {
                    top: visible.rect.bottom + 8,
                    maxHeight: window.innerHeight - visible.rect.bottom - 24,
                  }),
            }}
            onMouseEnter={keepOpen}
            onMouseLeave={closeSoon}
            onFocus={keepOpen}
            onBlur={(event) => closeOnBlur(event.relatedTarget)}
          >
            <div className="skill-context-heading">
              <strong>{visible.annotation.name}</strong>
              <button
                type="button"
                aria-label="Close match context"
                onClick={() => setActive(null)}
              >
                <X size={15} />
              </button>
            </div>
            <span className={`confidence-${visible.annotation.confidence}`}>
              {coverageLabel(visible.annotation.decision)}
            </span>
            <p>
              {visible.annotation.decision === 'partial' && visible.annotation.path.length > 0
                ? `${visible.annotation.sourceName} provides related experience, but does not directly establish ${visible.annotation.name.toLowerCase()}.`
                : visible.annotation.reason}
            </p>
            {visible.annotation.sourceName && (
              <p className="small-note">
                Resume skill: <strong>{visible.annotation.sourceName}</strong>
              </p>
            )}
            {visible.annotation.path.length > 0 && (
              <ul>
                {visible.annotation.path.map((edge, index) => (
                  <li key={index}>{edge.reason}</li>
                ))}
              </ul>
            )}
            {[...new Set(excerpts)].slice(0, 2).map((excerpt, index) => (
              <blockquote key={index}>{excerpt}</blockquote>
            ))}
            {visible.annotation.decision === 'suggested' && (
              <p className="small-note">This possible skill contributes no match credit.</p>
            )}
            {visible.annotation.interpretation === 'contextual' && (
              <p className="small-note">Role context, rather than a scored qualification.</p>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
