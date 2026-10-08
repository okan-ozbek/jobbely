import { useEffect, useId, useRef, useState } from 'react';
import { LogOut, UserRound } from 'lucide-react';

export function AccountAvatarMenu({
  email,
  busy,
  error,
  active,
  onAccount,
  onSignOut,
}: {
  email: string | null;
  busy: boolean;
  error: string;
  active: boolean;
  onAccount: () => void;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    panel.current?.querySelector('button')?.focus();

    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    window.addEventListener('pointerdown', dismiss);

    return () => window.removeEventListener('pointerdown', dismiss);
  }, [open]);

  return (
    <div
      className="account-avatar-menu"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        className={`account-avatar${active ? ' active' : ''}`}
        aria-label="Open account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <UserRound
          size={20}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div
          id={id}
          ref={panel}
          className="account-avatar-panel"
          role="menu"
          aria-label="Account"
          onKeyDown={(event) => {
            const items = [
              ...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
            ];

            const index = items.indexOf(document.activeElement as HTMLButtonElement);
            let next: number | undefined;

            if (event.key === 'ArrowDown') {
              next = (index + 1) % items.length;
            }

            if (event.key === 'ArrowUp') {
              next = (index - 1 + items.length) % items.length;
            }

            if (event.key === 'Home') {
              next = 0;
            }

            if (event.key === 'End') {
              next = items.length - 1;
            }

            if (next !== undefined) {
              event.preventDefault();
              items[next]?.focus();
            }
          }}
        >
          <p className="account-avatar-email">{email ?? 'Your Jobbely account'}</p>
          <button
            role="menuitem"
            disabled={busy}
            onClick={() => {
              setOpen(false);
              onAccount();
            }}
          >
            <UserRound
              size={16}
              aria-hidden="true"
            />{' '}
            Account
          </button>
          <button
            role="menuitem"
            disabled={busy}
            onClick={onSignOut}
          >
            <LogOut
              size={16}
              aria-hidden="true"
            />{' '}
            {busy ? 'Signing out…' : 'Sign out'}
          </button>
          {error && (
            <p
              className="account-error"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
