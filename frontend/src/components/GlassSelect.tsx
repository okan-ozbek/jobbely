import { Children, isValidElement, useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { createPortal } from 'react-dom';

/** A searchable listbox shared by catalog filters and profile review controls. */
export function GlassSelect({
  value,
  onValueChange,
  children,
  disabled,
  'aria-label': label,
}: {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
  'aria-label'?: string;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(value);

  const options = Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ value: string; children: ReactNode }>(child)) {
      return [];
    }

    // Callers supply ordinary option elements, including arrays of mapped options.
    return [{ value: child.props.value, label: String(child.props.children) }];
  });

  const filtered = options.filter((option) =>
    option.label.toLowerCase().includes(search.toLowerCase()),
  );

  const selected = options.find((option) => option.value === value);

  const activeValue = filtered.some((option) => option.value === active)
    ? active
    : filtered[0]?.value;

  const activeIndex = filtered.findIndex((option) => option.value === activeValue);

  const open = () => {
    setSearch('');
    setActive(value);
    setRect(trigger.current!.getBoundingClientRect());
  };

  const close = (focus = false) => {
    setRect(null);

    if (focus) {
      trigger.current?.focus();
    }
  };

  const choose = (next: string) => {
    onValueChange(next);
    close(true);
  };

  useEffect(() => {
    if (!rect) {
      return;
    }

    panel.current?.querySelector('input')?.focus();

    const dismiss = (event: Event) => {
      if (
        event.target instanceof Node &&
        (panel.current?.contains(event.target) || trigger.current?.contains(event.target))
      ) {
        return;
      }

      setRect(null);
    };

    window.addEventListener('pointerdown', dismiss);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);

    return () => {
      window.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [rect]);

  useEffect(() => {
    panel.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [activeValue]);

  useEffect(() => {
    if (disabled) {
      setRect(null);
    }
  }, [disabled]);

  const below = rect ? window.innerHeight - rect.bottom - 16 : 0;
  const above = rect ? rect.top - 16 : 0;
  const openAbove = below < Math.min(280, above);
  const height = Math.min(320, Math.max(80, openAbove ? above : below));

  const top = rect ? (openAbove ? Math.max(16, rect.top - height - 8) : rect.bottom + 8) : 0;

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="glass-select-trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={!!rect}
        aria-controls={rect ? id : undefined}
        disabled={disabled}
        onClick={() => (rect ? close() : open())}
        onKeyDown={(event) => {
          if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            open();
          }
        }}
      >
        <span>{selected?.label ?? value}</span>
        <ChevronDown size={16} />
      </button>
      {rect &&
        createPortal(
          <div
            ref={panel}
            className="glass-select-panel"
            style={{
              top,
              left: Math.min(
                rect.left,
                window.innerWidth -
                  Math.min(Math.max(rect.width, 220), window.innerWidth - 32) -
                  16,
              ),
              width: Math.min(Math.max(rect.width, 220), window.innerWidth - 32),
              maxHeight: height,
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                close(true);
              }

              if (event.key === 'Tab') {
                close(true);
              }

              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();

                setActive(
                  filtered[
                    (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + filtered.length) %
                      filtered.length
                  ]?.value ?? '',
                );
              }

              if ((event.key === 'Home' || event.key === 'End') && event.ctrlKey) {
                event.preventDefault();
                setActive((event.key === 'Home' ? filtered[0] : filtered.at(-1))?.value ?? '');
              }

              if (event.key === 'Enter' && activeValue !== undefined) {
                event.preventDefault();
                choose(activeValue);
              }
            }}
          >
            <label className="glass-select-search">
              <Search size={15} />
              <input
                role="combobox"
                aria-label={`Search ${label?.toLowerCase() ?? 'options'}`}
                aria-autocomplete="list"
                aria-expanded="true"
                aria-controls={id}
                aria-activedescendant={activeIndex >= 0 ? `${id}-${activeIndex}` : undefined}
                placeholder="Find an option…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <div
              role="listbox"
              id={id}
              aria-label={label}
              className="glass-select-options"
            >
              {filtered.map((option, index) => (
                <button
                  type="button"
                  role="option"
                  tabIndex={-1}
                  id={`${id}-${index}`}
                  key={option.value}
                  aria-selected={option.value === value}
                  data-active={option.value === activeValue}
                  className={option.value === value ? 'is-selected' : ''}
                  onPointerMove={() => setActive(option.value)}
                  onClick={() => choose(option.value)}
                >
                  <span>{option.label}</span>
                  {option.value === value && <Check size={15} />}
                </button>
              ))}
              {!filtered.length && <p className="small-note">No matching options.</p>}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
