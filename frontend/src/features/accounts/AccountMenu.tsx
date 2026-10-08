import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import type { Account, SignInProvider } from '../../api/accounts.js';
import {
  currentAccount,
  deleteAccount,
  signInProviders,
  signOut,
  startSignIn,
} from '../../api/accounts.js';
import { ApiError } from '../../api/client.js';
import './accounts.css';
import { EmailAccountForm } from './EmailAccountForm.js';
import { AccountEmailChangeForm } from './AccountEmailChangeForm.js';
import { AuthShell } from './AuthShell.js';
import { AccountAvatarMenu } from './AccountAvatarMenu.js';

export type AccountAction = 'email' | 'reset' | 'delete' | 'signout' | 'refresh';

const names = { github: 'GitHub', linkedin: 'LinkedIn' };

export function AccountMenu({
  onSessionEnd,
  onDeleted,
  openRequest = 0,
  onAccountChange,
  onOpenAccount,
  isAccountPage,
  actionRequest,
  onActionHandled,
  onMutationChange,
  onErrorChange,
  onNoticeChange,
}: {
  onSessionEnd: () => void;
  onDeleted: () => void;
  openRequest?: number;
  onAccountChange: (account: Account | null) => void;
  onOpenAccount: () => void;
  isAccountPage: boolean;
  actionRequest: AccountAction | null;
  onActionHandled: () => void;
  onMutationChange: (busy: boolean) => void;
  onErrorChange: (error: string) => void;
  onNoticeChange: (notice: string) => void;
}) {
  const [account, setAccount] = useState<Account | null>(null);
  const [providers, setProviders] = useState<{ name: SignInProvider; available: boolean }[]>([]);
  const [emailAvailable, setEmailAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [present, setPresent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [panel, setPanel] = useState<'details' | 'email' | 'reset'>('details');
  const [notice, setNotice] = useState('');
  const [link, setLink] = useState<{ provider: SignInProvider; url: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const backdropPressed = useRef(false);
  const animatedGuestDialog = useRef(false);
  const active = useRef<AbortController | null>(null);
  const readRequest = useRef<AbortController | null>(null);
  const userId = useRef<string | null>(null);
  const mutating = useRef(false);
  const ended = useRef(onSessionEnd);
  const accountChanged = useRef(onAccountChange);
  const titleId = useId();

  useEffect(() => {
    ended.current = onSessionEnd;
  }, [onSessionEnd]);

  useEffect(() => {
    accountChanged.current = onAccountChange;
  }, [onAccountChange]);

  useEffect(() => {
    onErrorChange(error);
  }, [error, onErrorChange]);

  useEffect(() => {
    onNoticeChange(notice);
  }, [notice, onNoticeChange]);

  const refresh = useCallback(async () => {
    if (mutating.current) {
      return;
    }

    readRequest.current?.abort();

    const controller = new AbortController();

    readRequest.current = controller;

    try {
      const result = await currentAccount(controller.signal);

      if (controller.signal.aborted) {
        return;
      }

      if (userId.current && userId.current !== result.user?.id) {
        ended.current();
        setConfirmDelete(false);
        setDeleteText('');
        setPanel('details');
      }

      if (!userId.current && result.user) {
        setOpen(false);
        setLink(null);
      }

      userId.current = result.user?.id ?? null;
      setAccount(result);
      accountChanged.current(result);
      setError('');
    } catch (failure) {
      if (controller.signal.aborted) {
        return;
      }

      if (failure instanceof ApiError && failure.code === 'authentication_required') {
        if (userId.current) {
          ended.current();
        }

        userId.current = null;
        setAccount(null);
        accountChanged.current(null);
      }

      setError(failure instanceof Error ? failure.message : 'Could not load your account.');
    }
  }, []);

  useEffect(() => {
    if (openRequest > 0) {
      setPanel('details');
      setConfirmDelete(false);
      setOpen(true);
      void refresh();
    }
  }, [openRequest, refresh]);

  useEffect(() => {
    if (!actionRequest) {
      return;
    }

    onActionHandled();

    if (mutating.current) {
      return;
    }

    setNotice('');
    setError('');

    if (actionRequest === 'refresh') {
      void refresh();
    } else if (actionRequest === 'signout') {
      void endAccount();
    } else {
      setPanel(actionRequest === 'delete' ? 'details' : actionRequest);
      setConfirmDelete(actionRequest === 'delete');
      setDeleteText('');
      setOpen(true);
      void refresh();
    }
  }, [actionRequest, refresh, onActionHandled]);

  useEffect(() => {
    void refresh();

    const onFocus = () => {
      void refresh();
    };

    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener('focus', onFocus);
      active.current?.abort();
      readRequest.current?.abort();
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) {
      const element = dialog.current;

      active.current?.abort();

      if (
        !element?.open ||
        !animatedGuestDialog.current ||
        !element.classList.contains('account-dialog-auth') ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        element?.close();
        setPresent(false);

        return;
      }

      const appearance = getComputedStyle(element);
      const from = { opacity: appearance.opacity, transform: appearance.transform };

      element.dataset.closing = 'true';

      const animation = element.animate(
        [from, { opacity: 0, transform: 'translateY(10px) scale(0.98)' }],
        { duration: 160, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' },
      );

      void animation.finished
        .then(() => {
          element.close();
          setPresent(false);
        })
        .catch(() => {});

      return () => {
        animation.cancel();
        delete element.dataset.closing;
      };
    }

    setPresent(true);

    animatedGuestDialog.current =
      dialog.current?.classList.contains('account-dialog-auth') ?? false;

    dialog.current?.showModal();

    const controller = new AbortController();

    setLoading(true);

    signInProviders(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setProviders(result.items);
          setEmailAvailable(result.emailAvailable);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError('Could not load sign-in options.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [open]);

  async function begin(provider: SignInProvider) {
    active.current?.abort();

    const controller = new AbortController();

    active.current = controller;
    setLoading(true);
    setError('');
    setLink(null);

    try {
      const url = await startSignIn(provider, controller.signal);

      if (!controller.signal.aborted) {
        setLink({ provider, url });
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(failure instanceof Error ? failure.message : 'Could not sign in.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }

  async function endAccount(remove = false) {
    if (!account?.csrfToken || mutating.current) {
      return;
    }

    if (remove && (!confirmDelete || deleteText !== 'DELETE')) {
      return;
    }

    active.current?.abort();
    readRequest.current?.abort();

    const controller = new AbortController();

    active.current = controller;
    mutating.current = true;
    onMutationChange(true);
    setLoading(true);
    setError('');

    try {
      if (remove) {
        await deleteAccount(account.csrfToken, controller.signal);
      } else {
        await signOut(account.csrfToken, controller.signal);
      }

      if (!controller.signal.aborted) {
        readRequest.current?.abort();
        ended.current();
        userId.current = null;
        setAccount(null);
        accountChanged.current(null);
        setLink(null);
        setConfirmDelete(false);
        setDeleteText('');
        setOpen(false);
        setNotice('');

        if (remove) {
          onDeleted();
        }
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        if (remove && failure instanceof ApiError && failure.code === 'authentication_required') {
          setConfirmDelete(false);
          setDeleteText('');
          setPanel('details');
          setNotice('');
        }

        setError(
          failure instanceof Error
            ? failure.message
            : remove
              ? 'Could not delete your account. Please try again.'
              : 'Could not sign out.',
        );
      }
    } finally {
      mutating.current = false;
      onMutationChange(false);

      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }

  return (
    <>
      {account?.user ? (
        <AccountAvatarMenu
          key={account.user.id}
          email={account.user.email}
          busy={loading}
          error={error}
          active={isAccountPage}
          onAccount={onOpenAccount}
          onSignOut={() => {
            void endAccount();
          }}
        />
      ) : (
        <button
          className="nav-link"
          onClick={() => {
            setLink(null);
            setConfirmDelete(false);
            setDeleteText('');
            setOpen(true);
          }}
        >
          Sign in
        </button>
      )}
      <dialog
        className={`account-dialog${!account?.user ? ' account-dialog-auth' : ''}`}
        ref={dialog}
        inert={!open}
        aria-labelledby={titleId}
        onPointerDown={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();

          backdropPressed.current =
            event.target === event.currentTarget &&
            (event.clientX < bounds.left ||
              event.clientX > bounds.right ||
              event.clientY < bounds.top ||
              event.clientY > bounds.bottom);
        }}
        onClick={(event) => {
          const startedOutside = backdropPressed.current;

          backdropPressed.current = false;

          if (account?.user || !startedOutside || event.target !== event.currentTarget) {
            return;
          }

          const bounds = event.currentTarget.getBoundingClientRect();

          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          ) {
            setOpen(false);
          }
        }}
        onCancel={(event) => {
          event.preventDefault();

          if (!mutating.current) {
            setOpen(false);
          }
        }}
        onClose={() => {
          setPresent(false);
          setOpen(false);
          setConfirmDelete(false);
          setDeleteText('');
          setPanel('details');
          active.current?.abort();
        }}
      >
        <AuthShell
          signedIn={!!account?.user}
          onClose={() => setOpen(false)}
        >
          {account?.user && (
            <div className="account-dialog-heading">
              <h2 id={titleId}>
                {account?.user
                  ? confirmDelete
                    ? 'Delete account'
                    : panel === 'email'
                      ? 'Change your email'
                      : panel === 'reset'
                        ? 'Reset your password'
                        : 'Your account'
                  : 'Welcome to Jobbely'}
              </h2>
              <button
                className="icon-button"
                aria-label="Close account dialog"
                disabled={loading && mutating.current}
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
          )}
          {account?.user ? (
            confirmDelete ? (
              <form
                className="account-form account-delete-confirmation"
                aria-busy={loading}
                onSubmit={(event) => {
                  event.preventDefault();
                  void endAccount(true);
                }}
              >
                <h3>Delete your account?</h3>
                <p>{account.user.email ?? 'You’re signed in.'}</p>
                <p className="small-note">
                  This permanently removes your account and sign-in details, signs you out of all
                  sessions, and clears the resume from this tab. This cannot be undone.
                </p>
                <label>
                  Type DELETE to confirm
                  <input
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    value={deleteText}
                    onChange={(event) => setDeleteText(event.target.value)}
                    disabled={loading}
                  />
                </label>
                <div className="account-actions">
                  <button
                    className="account-danger-button"
                    type="submit"
                    disabled={loading || deleteText !== 'DELETE'}
                  >
                    {loading ? 'Deleting…' : 'Permanently delete'}
                  </button>
                </div>
              </form>
            ) : panel === 'email' && account.csrfToken ? (
              <AccountEmailChangeForm
                showHeading={false}
                csrfToken={account.csrfToken}
                onCancel={() => setOpen(false)}
                onChanged={async () => {
                  await refresh();
                  setPanel('details');
                  setOpen(false);
                  setNotice('Your email was updated. Your other sessions have been signed out.');
                }}
              />
            ) : panel === 'reset' ? (
              <EmailAccountForm
                showHeading={false}
                available={emailAvailable}
                initialMode="reset"
                initialEmail={account.user.email ?? ''}
                onBack={() => setOpen(false)}
                onSignedIn={refresh}
                onPasswordReset={async () => {
                  await refresh();
                  setPanel('details');
                  setNotice('Password updated. Sign in with your new password.');
                }}
              />
            ) : (
              <div className="account-dialog-redirect">
                <p>Manage your details and plan in your account workspace.</p>
                <button
                  className="primary-button"
                  onClick={() => {
                    setOpen(false);
                    onOpenAccount();
                  }}
                >
                  Open your account
                </button>
              </div>
            )
          ) : (
            <>
              {present && (
                <EmailAccountForm
                  workspace
                  headingId={titleId}
                  available={emailAvailable}
                  onSignedIn={refresh}
                  onPasswordReset={refresh}
                />
              )}
              {providers.some((provider) => provider.available) && (
                <>
                  <div className="auth-provider-divider">
                    <span>Or continue with</span>
                  </div>
                  <div className="account-provider-buttons">
                    {(['github', 'linkedin'] as const).map((provider) => (
                      <button
                        key={provider}
                        className="secondary-button"
                        disabled={
                          loading || !providers.find((item) => item.name === provider)?.available
                        }
                        onClick={() => {
                          void begin(provider);
                        }}
                      >
                        Sign in with {names[provider]}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {link && (
                <a
                  className="primary-button account-continue"
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Continue with {names[link.provider]} <ArrowUpRight size={16} />
                </a>
              )}
            </>
          )}
          {loading && (
            <p
              className="small-note"
              role="status"
            >
              Please wait…
            </p>
          )}
          {notice && (
            <p
              className="small-note"
              role="status"
            >
              {notice}
            </p>
          )}
          {error && (
            <p
              className="account-error"
              role="alert"
            >
              {error}
            </p>
          )}
        </AuthShell>
      </dialog>
    </>
  );
}
